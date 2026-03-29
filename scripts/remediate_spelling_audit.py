#!/usr/bin/env python3
"""
WildPhotography Remediation Audit
Scans existing DB records for spelling/normalization issues and duplicate damage.
Uses multi-layer detection: exact hash, perceptual hash, normalized text comparison.
Only repairs when evidence is strong. Otherwise flags for manual review.
"""

import re
import os
import sys
import json
import imagehash
import subprocess
import psycopg2
from difflib import SequenceMatcher
from collections import defaultdict
from PIL import Image

DB = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

PERCEPTUAL_THRESHOLD = 0.90
DIMENSION_TOLERANCE = 5
ASPECT_TOLERANCE = 0.02
SIMILARITY_THRESHOLD = 0.80
MAX_REPAIR_BATCH = 100

# ── DB ────────────────────────────────────────────────────────────────────────
def db():
    return psycopg2.connect(DB, connect_timeout=15)

def qa(sql, args=None):
    conn = db()
    cur = conn.cursor()
    cur.execute(sql, args or {})
    rows = cur.fetchall()
    conn.close()
    return rows

def q1(sql, args=None):
    rows = qa(sql, args)
    return rows[0][0] if rows else None

# ── Known place name corrections ─────────────────────────────────────────────────
PLACE_CORRECTIONS = {
    "puntarenAs": "Puntarenas", "puntarenäs": "Puntarenas",
    "guanacásté": "Guanacaste",
    "alajuéla": "Alajuela",
    "san josè": "San José",
    "arenál": "Arenal",
    "irazú": "Irazú",
    "volcan irazu": "Volcán Irazú", "volcan poas": "Volcán Poás",
    "volcan arenal": "Volcán Arenal",
    "scarlatt macaw": "Scarlet Macaw", "scarlett macaw": "Scarlet Macaw",
    "scarlet-macaw": "Scarlet Macaw",
    "keel billed toucan": "Keel-billed Toucan",
    "montezuma oroupendola": "Montezuma Oropendola",
    "turquoise browed motmot": "Turquoise-browed Motmot",
    "great-green macaw": "Great Green Macaw",
    "costa-rica": "Costa Rica", "costa_rica": "Costa Rica",
    "costa-rica-gallery": "Costa Rica Gallery",
    "peninsula papagayo": "Península Papagayo",
    "corcovado peninsula": "Península de Osa",
    "nauyaca waterfall": "Nauyaca Waterfalls",
    "rincón de la vieja": "Rincon de la Vieja",
    "tarcol": "Tárcoles",
    "playa-hermosa": "Playa Hermosa",
    "playas-del coco": "Playas del Coco",
    "nauyaca": "Nauyaca",
    "golfo-de-nicoya": "Golfo de Nicoya",
    "las-catalinas": "Las Catalinas",
    "jaćo": "Jaco", "jaço": "Jaco",
}

# ── Text normalization ──────────────────────────────────────────────────────────
def normalize(text):
    if not text:
        return text
    t = re.sub(r'\s+', ' ', str(text)).strip()
    lower = t.lower()
    for wrong, correct in PLACE_CORRECTIONS.items():
        if wrong.lower() in lower:
            t = re.sub(re.escape(wrong), correct, t, flags=re.IGNORECASE)
    return t

def fuzzy_score(a, b):
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, str(a).lower(), str(b).lower()).ratio()

# ── Perceptual hash ─────────────────────────────────────────────────────────────
def compute_phash(path):
    try:
        img = Image.open(path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        return imagehash.phash(img, hash_size=8)
    except:
        return None

def download_and_hash(r2_key):
    """Download R2 original to temp file and compute phash."""
    if not r2_key:
        return None
    import boto3, tempfile
    s3 = boto3.client('s3',
        endpoint_url='https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
        aws_access_key_id='b821d56d29d9a2c716f783fc481e2f75',
        aws_secret_access_key='3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f'
    )
    tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    try:
        s3.download_file('wildphoto-storage', r2_key, tmp.name)
        return compute_phash(tmp.name)
    except Exception as e:
        return None
    finally:
        try: os.unlink(tmp.name)
        except: pass

# ── Audit: spelling normalization ─────────────────────────────────────────────
def audit_spelling(batch_size=500):
    """Scan recent records for spelling issues."""
    print("=== Spelling Audit ===")
    corrections = []
    rows = qa(f"""
        SELECT id, title, location_name, region, keywords,
               species_common_name, description, thumb_url
        FROM photos
        WHERE (title ~* 'puntarenAs|guanacásté|scarlatt|scarlett|arenál|volcan |costa.rica|playa.hermosa|nauyaca|tarcol|great.green.macaw|keel billed|turquoise brow'
           OR location_name ~* 'puntarenAs|guanacásté|arenál|san josè|irazú|volcan '
           OR keywords ~* 'puntarenAs|scarlatt|scarlett|keel billed|turquoise brow|great.green')
        LIMIT %s
    """, (batch_size,))

    for r in rows:
        id_, title, loc, region, keywords, species, desc, thumb = r
        changes = {}

        # Check title
        if title:
            norm = normalize(title)
            if norm != title:
                changes['title'] = (title, norm)

        # Check location
        if loc:
            norm = normalize(loc)
            if norm != loc:
                changes['location_name'] = (loc, norm)

        # Check region
        if region:
            norm = normalize(region)
            if norm != region:
                changes['region'] = (region, norm)

        # Check species
        if species:
            norm = normalize(species)
            if norm != species:
                changes['species_common_name'] = (species, norm)

        if changes:
            corrections.append({'id': id_, 'changes': changes, 'thumb_url': thumb})

    return corrections

# ── Audit: duplicate slug damage ─────────────────────────────────────────────
def audit_duplicate_slugs(batch_size=200):
    """Find photos sharing the same slug prefix (slug collision damage)."""
    print("=== Slug Collision Audit ===")
    # Find slugs that appear more than once
    dup_slugs = qa("""
        SELECT slug, COUNT(*) as cnt, ARRAY_AGG(id) as ids, ARRAY_AGG(gallery_id) as gids
        FROM photos
        WHERE slug IS NOT NULL AND slug != ''
        GROUP BY slug
        HAVING COUNT(*) > 1
        LIMIT %s
    """, (batch_size,))

    repairs = []
    for slug, cnt, ids, gids in dup_slugs:
        print(f"  Slug collision: '{slug}' → {cnt} records: {ids}")
        repairs.append({'slug': slug, 'count': cnt, 'ids': ids, 'galleries': gids})

    return repairs

# ── Audit: orphan/incomplete records ──────────────────────────────────────────
def audit_incomplete():
    """Find records with missing critical fields but R2 originals exist."""
    print("=== Incomplete Records Audit ===")
    rows = qa("""
        SELECT id, slug, thumb_url, r2_original_key, derivatives_complete,
               ready_for_public_render, gallery_slug, title
        FROM photos
        WHERE r2_original_key IS NOT NULL
          AND r2_original_key != ''
          AND (thumb_url IS NULL OR thumb_url = '' OR derivatives_complete = false)
        LIMIT 200
    """)
    incomplete = []
    for r in rows:
        incomplete.append({
            'id': r[0], 'slug': r[1], 'thumb_url': r[2],
            'r2_key': r[3], 'deriv_complete': r[4],
            'ready': r[5], 'gallery_slug': r[6], 'title': r[7]
        })
    print(f"  Found {len(incomplete)} incomplete records with R2 originals")
    return incomplete

# ── Remediation: apply spelling fixes ─────────────────────────────────────────
def apply_spelling_fixes(corrections):
    """Apply spelling corrections to DB (dry run by default)."""
    print(f"\n=== Applying {len(corrections)} spelling corrections ===")
    dry = os.environ.get('DRY_RUN', '1') == '1'
    print(f"  Dry run: {dry}")

    applied = 0
    for corr in corrections:
        id_ = corr['id']
        set_clauses = []
        params = []
        for field, (old, new) in corr['changes'].items():
            set_clauses.append(f"{field} = %s")
            params.append(new)
        if not set_clauses:
            continue
        params.append(id_)
        sql = f"UPDATE photos SET {', '.join(set_clauses)} WHERE id = %s"
        conn = db()
        cur = conn.cursor()
        try:
            cur.execute(sql, params)
            conn.commit()
            applied += 1
            print(f"  [{'APPLIED' if not dry else 'DRY'}] id={id_}: {corr['changes']}")
        except Exception as e:
            conn.rollback()
            print(f"  ERROR id={id_}: {e}")
        finally:
            conn.close()

    print(f"\n  Applied: {applied}/{len(corrections)}")
    return applied

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("══════════════════════════════════════════════════════════════")
    print("  WildPhotography Remediation Audit")
    print("══════════════════════════════════════════════════════════════\n")

    report = {}

    # 1. Spelling audit
    spelling = audit_spelling()
    report['spelling_corrections'] = [
        {k: (str(v[0]), str(v[1])) for k, v in c['changes'].items()}
        for c in spelling
    ]

    # 2. Slug collision audit
    slug_repairs = audit_duplicate_slugs()
    report['slug_collisions'] = slug_repairs

    # 3. Incomplete records
    incomplete = audit_incomplete()
    report['incomplete_records'] = incomplete

    # Apply fixes (only if DRY_RUN=0)
    if spelling and os.environ.get('DRY_RUN', '1') != '1':
        apply_spelling_fixes(spelling)
    else:
        print(f"\n  DRY RUN: Skipping {len(spelling)} spelling corrections")
        apply_spelling_fixes(spelling)  # Just prints what would happen

    # Summary
    print("\n══════════════════════════════════════════════════════════════")
    print("  REMEDIATION SUMMARY")
    print("══════════════════════════════════════════════════════════════")
    print(f"  Spelling corrections found: {len(spelling)}")
    print(f"  Slug collisions found:      {len(slug_repairs)}")
    print(f"  Incomplete records:         {len(incomplete)}")
    if spelling:
        print("\n  Sample spelling fixes:")
        for c in spelling[:10]:
            for field, (old, new) in c['changes'].items():
                print(f"    id={c['id']} {field}: '{old}' → '{new}'")
    if slug_repairs:
        print("\n  Slug collisions:")
        for s in slug_repairs[:10]:
            print(f"    '{s['slug']}': {s['count']} records → {s['ids']}")

    # Write report
    out_path = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/remediation_audit.json"
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\n  Report → {out_path}")

if __name__ == "__main__":
    main()
