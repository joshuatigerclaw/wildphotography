#!/usr/bin/env python3
"""
WildPhotography SEO Metadata Generator
Generates: seo_title, meta_description, og_title, og_description, og_image_url
for photos at the point they become publish-ready.

Triggered: end of import / end of derivative rebuild.
Does NOT overwrite high-quality existing metadata unless improved.
"""

import re
import json
import psycopg2
import requests
from datetime import datetime
from difflib import SequenceMatcher

# ── Config ─────────────────────────────────────────────────────────────────────
DB = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# Location spelling corrections (applied before SEO generation)
LOCATION_FIXES = {
    "puntarenAs": "Puntarenas", "puntarenäs": "Puntarenas",
    "guanacásté": "Guanacaste", "guanacaste": "Guanacaste",
    "alajuéla": "Alajuela", "alajuela": "Alajuela",
    "san josè": "San José", "sanjose": "San José",
    "san josé": "San José", "san jose": "San José",
    "arenál": "Arenal", "arenal": "Arenal",
    "irazú": "Irazú", "irazu": "Irazú",
    "volcan irazu": "Volcán Irazú", "volcan poas": "Volcán Poás",
    "volcan arenal": "Volcán Arenal", "poas": "Poás",
    "poás": "Poás",
    "montezuma": "Montezuma", "montezuma ": "Montezuma",
    "tamarindo": "Tamarindo", "samara": "Sámara",
    "samara": "Sámara", "sámara": "Sámara",
    "papagayo": "Papagayo",
    "costa-rica": "Costa Rica", "costa_rica": "Costa Rica",
    "costa rica": "Costa Rica",
    "costa-rica-gallery": "Costa Rica",
    "nicoya": "Nicoya",
    "osa": "Osa", "corcovado": "Corcovado",
    "tortuguero": "Tortuguero",
    "manuel antonio": "Manuel Antonio",
    "puerto viejo": "Puerto Viejo",
    "guanacaste": "Guanacaste",
    "quetzal": "Quetzal",
    "nauyaca": "Nauyaca", "nauyaca waterfall": "Nauyaca Waterfalls",
    "tarcoles": "Tárcoles", "tarcol": "Tárcoles",
    "las catalinas": "Las Catalinas",
    "flamingo": "Flamingo", "playas del coco": "Playas del Coco",
    "playa hermosa": "Playa Hermosa", "playa-hermosa": "Playa Hermosa",
    "dominical": "Dominical", "uvita": "Uvita",
    "jaco": "Jaco", "jaćo": "Jaco",
}

# Species name corrections
SPECIES_FIXES = {
    "scarlatt macaw": "Scarlet Macaw",
    "scarlett macaw": "Scarlet Macaw",
    "scarlet-macaw": "Scarlet Macaw",
    "scarlet macaw": "Scarlet Macaw",
    "great-green macaw": "Great Green Macaw",
    "great green macaw": "Great Green Macaw",
    "keel billed toucan": "Keel-billed Toucan",
    "keel-billed toucan": "Keel-billed Toucan",
    "keelbilled toucan": "Keel-billed Toucan",
    "keel billed toucan": "Keel-billed Toucan",
    "turquoise browed motmot": "Turquoise-browed Motmot",
    "turquoise-browed motmot": "Turquoise-browed Motmot",
    "blue crowned motmot": "Blue-crowned Motmot",
    "blue-crowned motmot": "Blue-crowned Motmot",
    "montezuma oroupendola": "Montezuma Oropendola",
    "montezuma oropendola": "Montezuma Oropendola",
    "collared aracari": "Collared Aracari",
    "collared-aracari": "Collared Aracari",
    "green honeycreeper": "Green Honeycreeper",
    "green honeycrep": "Green Honeycreeper",
    "resplendent quetzal": "Resplendent Quetzal",
    "black guan": "Black Guan",
    "white-throated magpie-jay": "White-throated Magpie-Jay",
    "fiery-throated hummingbird": "Fiery-throated Hummingbird",
    "rufous-tailed hummingbird": "Rufous-tailed Hummingbird",
    "boat-billed heron": "Boat-billed Heron",
    "clay-colored thrush": "Clay-colored Thrush",
    "scarlet macaw": "Scarlet Macaw",
    "great green macaw": "Great Green Macaw",
}

# ── DB helpers ──────────────────────────────────────────────────────────────────
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

# ── Text normalization ─────────────────────────────────────────────────────────
def normalize(text):
    """Apply known spelling corrections to location/species names."""
    if not text:
        return text
    t = str(text).strip()
    lower = t.lower()
    for wrong, correct in {**LOCATION_FIXES, **SPECIES_FIXES}.items():
        if wrong.lower() in lower:
            t = re.sub(re.escape(wrong), correct, t, flags=re.IGNORECASE)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def normalize_species(name):
    """Species: title-case proper species names, preserve scientific names."""
    if not name:
        return name
    n = normalize(name)
    # Scientific names stay as-is (italicized later)
    if n and n[0].isupper() and ' ' in n and len(n) < 50:
        return n  # Likely a proper species name
    # Title-case common names
    words = n.split()
    corrected = []
    for w in words:
        wl = w.lower()
        if wl in ['macaw', 'toucan', 'quetzal', 'motmot', 'heron', 'hawk', 'owl',
                    'eagle', 'hummingbird', 'flycatcher', 'vireo', 'tanager',
                    'warbler', 'cardinal', 'grosbeak', 'oriole', 'robin', 'guanc',
                    'aracari', 'cockoo', 'tinamou', 'antbird', 'ani', 'cuckoo']:
            corrected.append(w[0].upper() + w[1:].lower())
        else:
            corrected.append(w[0].upper() + w[1:].lower() if w else w)
    return ' '.join(corrected)

def normalize_location(loc):
    """Normalize location: apply corrections + title case."""
    if not loc:
        return loc
    n = normalize(loc)
    return n.title() if n else n

# ── Title generation ──────────────────────────────────────────────────────────
def generate_seo_title(photo):
    """
    Format: {Primary Subject} in {Location}, {Region}, {Country} | WildPhotography
    Max ~65 chars. Intelligent truncation.
    """
    subject = normalize_species(photo.get('species_common_name') or photo.get('best_keyword', ''))
    location = normalize_location(photo.get('location_name') or photo.get('gallery_name', ''))
    region = normalize(photo.get('region', ''))
    country = normalize(photo.get('country', 'Costa Rica'))

    # Build parts
    parts = []
    if subject:
        parts.append(subject)
    if location:
        parts.append(location)
    if region and region != location:
        parts.append(region)
    parts.append(country)

    if not parts:
        return None

    title_str = ' in '.join(parts) + ' | WildPhotography'

    # Truncate at ~65 chars
    MAX_TITLE = 70
    if len(title_str) <= MAX_TITLE:
        return title_str

    # Try dropping from the end: country, region, location
    for drop_idx in range(len(parts) - 1, 0, -1):
        dropped = parts[drop_idx]
        shorter = ' in '.join(parts[:drop_idx]) + ' | WildPhotography'
        if len(shorter) <= MAX_TITLE:
            return shorter
        if drop_idx == 1:
            # Just subject + country
            break

    # Hard truncate with ellipsis
    return title_str[:MAX_TITLE - 2].rsplit(' ', 1)[0] + '… | WildPhotography'

def generate_og_title(seo_title):
    """OG title: slightly shorter than SEO title. Remove pipe if short enough."""
    if not seo_title:
        return None
    og = seo_title.split(' | ')[0] if ' | ' in seo_title else seo_title
    return og[:60] if len(og) > 60 else og

# ── Description generation ────────────────────────────────────────────────────
def generate_meta_description(photo):
    """
    120-160 char natural description:
    1. Opening sentence: subject + location
    2. Context paragraph
    3. Discovery sentence
    Soft keyword inclusion: Costa Rica, wildlife photography, birdwatching, travel
    """
    subject = normalize_species(
        photo.get('species_common_name') or
        photo.get('best_keyword', '') or
        photo.get('title', '')
    )
    location = normalize_location(photo.get('location_name'))
    region = normalize(photo.get('region', ''))
    gallery = photo.get('gallery_name', '')
    country = normalize(photo.get('country', 'Costa Rica'))

    # Build a rich location string
    loc_parts = [p for p in [location, region, country] if p] if location or region else [country]
    loc_str = ', '.join(loc_parts) if loc_parts else country

    descriptions = []

    # 1. Opening sentence
    if subject and loc_str:
        descriptions.append(
            f"{subject} photographed in {loc_str}, {country} — "
            f"captured by Joshua ten Brink."
        )
    elif subject:
        descriptions.append(
            f"{subject} — professional wildlife photography from Costa Rica "
            f"by Joshua ten Brink."
        )
    elif loc_str:
        descriptions.append(
            f"Stunning wildlife photograph from {loc_str}, {country}. "
            f"Part of the WildPhotography collection by Joshua ten Brink."
        )
    else:
        descriptions.append(
            f"Professional wildlife photography from Costa Rica by Joshua ten Brink. "
            f"Part of the WildPhotography collection."
        )

    desc = descriptions[0]

    # Ensure 120-160 chars
    if len(desc) < 120:
        extras = [
            f" This {country} nature photography collection showcases native wildlife "
            f"in its natural habitat.",
            f" See more Costa Rica wildlife photography from Joshua ten Brink.",
            f" Part of the WildPhotography Costa Rica nature and birdwatching archive.",
            f" Featured in the WildPhotography Costa Rica travel photography collection.",
        ]
        for extra in extras:
            if len(desc) + len(extra) <= 160:
                desc += extra
                break

    if len(desc) > 160:
        # Truncate at word boundary near 160
        truncated = desc[:157]
        last_space = truncated.rfind(' ')
        if last_space > 120:
            desc = truncated[:last_space] + '…'
        else:
            desc = truncated[:157] + '…'

    return desc

def generate_og_description(meta_desc):
    """OG description: reuse or shorten meta description."""
    if not meta_desc:
        return None
    og = meta_desc[:155] + '…' if len(meta_desc) > 155 else meta_desc
    return og

# ── OG image selection ──────────────────────────────────────────────────────────
def select_og_image(photo):
    """
    Priority: medium_url > large_url > preview_url
    Never: thumb_url or original_url
    """
    for field in ['medium_url', 'large_url', 'preview_url', 'small_url']:
        url = photo.get(field)
        if url and url.strip():
            return url
    return None

# ── Check existing metadata quality ──────────────────────────────────────────
def is_high_quality_seo(photo):
    """Return True if existing SEO metadata is good enough to preserve."""
    title = photo.get('seo_title', '') or ''
    desc = photo.get('meta_description', '') or ''

    # Must have non-trivial content
    if len(title) < 15:
        return False
    if len(desc) < 80:
        return False

    # Must not be a filename-based title
    title_lower = title.lower()
    filename_lower = (photo.get('filename') or '').lower()
    if filename_lower in title_lower and len(filename_lower) > 10:
        return False  # Likely just a filename dumped into title

    # Must contain some location or subject context
    has_context = any(x in title_lower for x in ['in ', 'costa rica', 'wildlife', 'photography', 'joshua'])
    if not has_context:
        return False

    return True

# ── Main generator ────────────────────────────────────────────────────────────
def generate_seo_for_photo(photo):
    """
    Generate SEO metadata for a single photo record dict.
    Returns (fields_to_update, og_image_url, was_skipped)
    """
    # Skip if already high-quality
    if is_high_quality_seo(photo):
        return {}, None, True

    seo_title = generate_seo_title(photo)
    og_title = generate_og_title(seo_title)
    meta_desc = generate_meta_description(photo)
    og_desc = generate_og_description(meta_desc)
    og_image = select_og_image(photo)

    fields = {
        'seo_title': seo_title,
        'og_title': og_title,
        'meta_description': meta_desc,
        'og_description': og_desc,
        'og_image_url': og_image,
    }

    # Remove None values
    fields = {k: v for k, v in fields.items() if v}

    return fields, og_image, False

# ── Batch processor ────────────────────────────────────────────────────────────
def process_batch(photo_ids, dry_run=False):
    """
    Process a batch of photo IDs.
    Returns (updated_count, skipped_count, failed_count, sample_outputs)
    """
    if not photo_ids:
        return 0, 0, 0, []

    conn = db()
    cur = conn.cursor()

    placeholders = ','.join(['%s'] * len(photo_ids))
    cur.execute(f"""
        SELECT
            p.id, p.slug, p.title, p.filename, p.description, p.description_long,
            p.keywords, p.location_name, p.region, p.country,
            p.species_common_name, g.name as gallery_name, p.gallery_slug,
            p.seo_title, p.meta_description, p.og_title, p.og_description, p.og_image_url,
            p.medium_url, p.large_url, p.preview_url, p.small_url, p.thumb_url,
            p.ready_for_public_render, p.search_ready,
            g.name as gallery_name2
        FROM photos p
        LEFT JOIN galleries g ON g.id = p.gallery_id
        WHERE p.id IN ({placeholders})
    """, tuple(photo_ids))

    rows = cur.fetchall()
    colnames = [d[0] for d in cur.description]
    conn.close()

    updated = 0
    skipped = 0
    failed = 0
    samples = []

    for row in rows:
        photo = dict(zip(colnames, row))

        # Build best_keyword for title fallback
        kw = photo.get('keywords', '') or ''
        first_kw = kw.split(',')[0].strip() if kw else ''
        photo['best_keyword'] = (
            photo.get('species_common_name') or
            first_kw or
            (photo.get('gallery_name') or photo.get('gallery_name2', '')).title()
        )

        fields, og_image, was_skipped = generate_seo_for_photo(photo)

        if was_skipped:
            skipped += 1
            continue

        if not fields:
            failed += 1
            continue

        # Write to DB
        if not dry_run:
            set_clauses = [f"{k} = %s" for k in fields.keys()]
            values = list(fields.values()) + [photo['id']]
            sql = f"UPDATE photos SET {', '.join(set_clauses)} WHERE id = %s"
            try:
                conn2 = db()
                cur2 = conn2.cursor()
                cur2.execute(sql, values)
                conn2.commit()
                conn2.close()
                updated += 1
            except Exception as e:
                failed += 1
                print(f"  ERROR updating photo {photo['id']}: {e}")
                continue
        else:
            updated += 1

        # Collect sample
        if len(samples) < 5:
            samples.append({
                'photo_url': f"https://wildphotography.com/photo/{photo['slug']}",
                'seo_title': fields.get('seo_title', ''),
                'meta_description': (fields.get('meta_description', '') or '')[:200],
                'og_image_url': fields.get('og_image_url', ''),
            })

    return updated, skipped, failed, samples

# ── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    dry_run = '--dry-run' in sys.argv

    photo_ids = []
    if len(sys.argv) > 1 and sys.argv[1] != '--dry-run':
        photo_ids = [int(x.strip()) for x in sys.argv[1].split(',') if x.strip().isdigit()]
    else:
        # Process photos that are ready but missing SEO
        conn = db()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.id FROM photos p
            WHERE p.ready_for_public_render = true
              AND p.search_ready = false
              AND p.seo_title IS NULL
              AND p.meta_description IS NULL
            LIMIT 500
        """)
        photo_ids = [r[0] for r in cur.fetchall()]
        conn.close()

    if not photo_ids:
        print("No photos to process.")
        sys.exit(0)

    print(f"\n=== SEO Metadata Generator ===")
    print(f"Photos to process: {len(photo_ids)}")
    print(f"Dry run: {dry_run}")
    print()

    updated, skipped, failed, samples = process_batch(photo_ids, dry_run=dry_run)

    print(f"  Updated:      {updated}")
    print(f"  Skipped (high quality): {skipped}")
    print(f"  Failed:       {failed}")
    print()

    if samples:
        print("Sample outputs:")
        for s in samples:
            print(f"\n  URL: {s['photo_url']}")
            print(f"  SEO Title: {s['seo_title']}")
            print(f"  Meta Desc: {s['meta_description'][:120]}...")
            print(f"  OG Image: {s['og_image_url']}")
