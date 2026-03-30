#!/usr/bin/env python3
"""
WildPhotography Photo SEO Upgrade Script
========================================
Generates SEO content for each eligible photo and stores it in photos.metadata JSONB.

Usage:
  python3 scripts/photo_seo_upgrade.py [batch_size] [offset]
"""
import os, sys, json, time, datetime
from datetime import timezone
import psycopg2

NEON_CONN = os.environ.get(
    "NEON_DATABASE_URL",
    "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
)

# ── Helpers ────────────────────────────────────────────────────────────────────
def kw(t):
    return ' '.join(str(t).strip().lower().split())

def kw_set(items):
    seen, out = set(), []
    for item in items:
        k = kw(item)
        if k and k not in seen and len(k) > 2:
            seen.add(k); out.append(k)
    return out

FALLBACK_BLURBS = [
    "Planning a trip to this region? Discover nearby Costa Rica experiences, nature tours, and wildlife excursions that pair perfectly with this location.",
    "Explore this part of Costa Rica with guided tours, wildlife experiences, and regional day trips — all bookable with trusted local operators.",
    "From coastal stretches to cloud forest trails, this region offers exceptional nature experiences. Find the best guided tours and wildlife excursions here.",
]
_blurb_idx = 0

def make_seo_title(p):
    s  = kw(p['species_common_name'] or '')
    lo = kw(p['location_name'] or p['location'] or '')
    rg = kw(p['region'] or '')
    co = kw(p['country'] or 'costa rica')
    gs = kw(p['gallery_slug'] or '')
    if s and lo: return f"{s} in {lo}, {co}"
    if s and rg: return f"{s} {co} Photography — {rg}"
    if lo:
        gn = ' '.join(gs.replace('-',' ').split()).title() if gs else 'Costa Rica'
        return f"{gn} Photography in {lo}, {co}"
    if rg: return f"Costa Rica {rg} Photography"
    return f"{co.title()} Wildlife Photography"

def make_description(p):
    sp = (p['species_common_name'] or '').strip()
    sn = (p['species_scientific_name'] or '').strip()
    lo = (p['location_name'] or p['location'] or '').strip()
    rg = (p['region'] or '').strip()
    co = (p['country'] or 'Costa Rica').strip()
    an = (p['animal_group'] or '').strip()
    gs = (p['gallery_slug'] or '').strip()
    gn = ' '.join(gs.replace('-',' ').split()).title() if gs else None

    parts = []
    if sp:
        parts.append(f"{sp} photographed in {lo or rg or co}.")
        if sn and sn != sp: parts.append(f" ({sn})")
    elif lo:
        parts.append(f"Captured in {lo}, {rg or co}.")
    else:
        parts.append(f"Wildlife photography from {rg or co}.")

    if sp:
        tmpl = [
            f"Nature photography capturing {sp.lower()} in its natural habitat — a remarkable species found throughout Costa Rica.",
            f"This {an.lower()} was photographed during fieldwork in {rg or co}, showcasing the country's remarkable biodiversity.",
            f"The setting of {lo or rg or co} provides ideal conditions for wildlife photography in Costa Rica.",
        ]
        parts.append(f" {tmpl[hash(sp.encode()) % len(tmpl)]}")
    elif lo:
        parts.append(f" This {rg or co} location offers exceptional opportunities for nature and wildlife photography.")

    if gn and gn not in (lo or ''):
        parts.append(f" Part of the {gn} gallery.")
    parts.append(" All images are available as high-resolution downloads.")

    text = ''.join(parts)
    words = text.split()
    if len(words) > 180:
        text = ' '.join(words[:180]).rstrip('.,;') + '...'
    return text

def make_clusters(p):
    sp = kw(p['species_common_name'] or '')
    sn = kw(p['species_scientific_name'] or '')
    lo = kw(p['location_name'] or p['location'] or '')
    rg = kw(p['region'] or '')
    co = kw(p['country'] or 'costa rica')
    an = kw(p['animal_group'] or '')
    gs = kw(p['gallery_slug'] or '')
    ek = kw_set((p['keywords'] or '').split(','))

    return {
        "primary_kw":       kw_set([sp or (an if an not in ('mammal','bird','reptile','amphibian','insect','') else ''),
            f"{co} wildlife photography", f"{rg or co} nature photography",
            f"{lo or rg or co} photo"] + ek[:3])[:8],

        "species_kw":       kw_set([sp, sn, f"{sp} bird", f"{an} wildlife",
            f"{an} {co}"] + [k for k in ek if sp and sp in k][:4])[:8],

        "location_kw":      kw_set([lo, rg, co, f"{lo} {rg}".strip(), f"{rg} {co}".strip(),
            f"{rg} costa rica"] + [k for k in ek if (lo and lo in k) or (rg and rg in k)][:4])[:8],

        "travel_intent_kw": kw_set([f"birdwatching {co}" if sp else f"wildlife tours {co}",
            f"where to see {sp or an or 'wildlife'} {co}",
            f"{lo or rg} tours", f"{rg} travel guide",
            f"{co} nature experiences",
            f"best places to photograph {sp or an or 'wildlife'}"] )[:8],

        "photography_kw":   kw_set([f"{sp or an or 'nature'} photography",
            f"tropical bird photography", f"{co} wildlife photography",
            f"{rg} photography", f"telephoto lens wildlife",
            f"nature photo {lo or rg or co}", f"high resolution wildlife photo"] )[:8],

        "longtail_kw":      kw_set([
            f"{sp} in {lo} {co}".strip() if sp and lo else '',
            f"{sp} wildlife photo {rg} {co}".strip() if sp else '',
            f"{lo} {an or 'wildlife'} photography".strip() if lo else '',
            f"{rg} {co} nature photography guide".strip(),
            f"best location for {sp or an} photography {co}".strip(),
            f"{sp} photo location {lo or rg} {co}".strip() if sp else '',
        ])[:10],
    }

def make_blurb(p):
    global _blurb_idx
    sp = (p['species_common_name'] or '').strip()
    lo = (p['location_name'] or '').strip()
    rg = (p['region'] or '').strip()
    if lo:
        if sp:
            tpls = [
                f"Planning a birding or wildlife trip to {lo}? Guided {sp.lower()} tours and nature experiences in {rg or 'Costa Rica'} pair perfectly with this photo location.",
                f"Near {lo} in {rg or 'Costa Rica'}, expert-led wildlife excursions offer close encounters with {sp.lower()} and other tropical species.",
                f"Combine your interest in {sp.lower()} photography with a guided {rg or lo} experience — discover the best local tours and day trips here.",
            ]
            return tpls[hash((sp+lo).encode()) % len(tpls)]
        else:
            tpls = [
                f"Planning a trip to {lo}? Discover the best guided tours, wildlife excursions, and nature experiences near this {rg or 'Costa Rica'} photo location.",
                f"Explore {lo} and the surrounding {rg or 'Costa Rica'} region with trusted local tour operators — from wildlife walks to coastal day trips.",
                f"Near this photo location in {lo}, you'll find excellent birding tours, nature hikes, and regional experiences worth adding to your itinerary.",
            ]
            return tpls[hash(lo.encode()) % len(tpls)]
    elif rg:
        if sp:
            return f"Looking for {sp.lower()} encounters in {rg}? Expert-guided wildlife tours and photography-focused excursions are available year-round in this part of Costa Rica."
        else:
            return f"The {rg} region offers exceptional Costa Rica nature experiences. Find the best wildlife tours, birding guides, and day trips from this area here."
    return FALLBACK_BLURBS[_blurb_idx % len(FALLBACK_BLURBS)]

# ── Main ───────────────────────────────────────────────────────────────────────
def run(batch_size=50, offset=0):
    global _blurb_idx
    conn = psycopg2.connect(NEON_CONN, connect_timeout=10)
    cur  = conn.cursor()
    total, skipped = 0, 0

    while True:
        cur.execute(f"""
            SELECT id, slug, title, description, description_long, keywords,
                   location_name, location, region, country,
                   species_common_name, species_scientific_name, animal_group, gallery_slug,
                   metadata
            FROM photos
            WHERE is_active = true
              AND ready_for_public_render = true
              AND thumb_url IS NOT NULL
              AND thumb_url <> ''
            ORDER BY id
            LIMIT {batch_size} OFFSET {offset}
        """)
        rows = cur.fetchall()
        if not rows:
            break

        for row in rows:
            pid = row[0]
            meta = row[14]

            # Skip already upgraded
            if meta and isinstance(meta, dict) and meta.get('seo_title'):
                skipped += 1
                continue

            p = {
                'title': row[2], 'description': row[3], 'description_long': row[4],
                'keywords': row[5], 'location_name': row[6], 'location': row[7],
                'region': row[8], 'country': row[9],
                'species_common_name': row[10], 'species_scientific_name': row[11],
                'animal_group': row[12], 'gallery_slug': row[13],
            }

            seo_title  = make_seo_title(p)
            meta_desc  = make_description(p)
            clusters   = make_clusters(p)
            blurb      = make_blurb(p)
            _blurb_idx += 1

            new_meta = dict(meta) if meta and isinstance(meta, dict) else {}
            new_meta.update({
                'seo_title':        seo_title,
                'meta_description': meta_desc,
                'keyword_clusters':  clusters,
                'affiliate_blurb':  blurb,
                'seo_upgraded_at':  datetime.datetime.now(timezone.utc).isoformat(),
            })

            cur.execute("UPDATE photos SET metadata = %s, updated_at = NOW() WHERE id = %s",
                        (json.dumps(new_meta), pid))
            total += 1
            if total % 20 == 0:
                conn.commit()
                print(f"  Committed {total}…")

        offset += batch_size
        conn.commit()
        print(f"Offset {offset}: processed {len(rows)} rows, total updated={total}, skipped={skipped}")

    cur.close()
    conn.close()
    print(f"\nDone. Updated: {total} | Skipped (already done): {skipped}")

if __name__ == '__main__':
    batch = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    offset = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    run(batch, offset)
