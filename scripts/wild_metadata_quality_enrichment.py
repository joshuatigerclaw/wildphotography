#!/usr/bin/env python3
"""
WildPhotography Metadata Quality Enrichment — Lobster Workflow
Improves non-blocking metadata quality for photos already in the system.
Handles: short titles, missing descriptions, missing keywords.
Does NOT trigger reindex or republish — purely quality improvement.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime, timezone

DB = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'

def connect():
    return psycopg2.connect(DB)

def is_generic_title(title):
    if not title:
        return True
    patterns = [
        r'^IMG[_\s]\d+.*$', r'^DSC[_-]?\d+.*$', r'^P\d{5,}.*$',
        r'^DJI[_\s]\d+.*$', r'^CL0A\d+.*$', r'^IMG\d+.*$',
        r'^P\d{6,}.*$', r'^PC3\d+.*$',
        r'^\s+In\s+Costa\s+Rica$',  # " In Costa Rica"
    ]
    import re
    for p in patterns:
        if re.match(p, title, re.IGNORECASE):
            return True
    return False

def build_better_title(photo):
    """Build a descriptive title from available metadata."""
    species = photo.get('species_common_name') or ''
    location = photo.get('location_name') or ''
    region = photo.get('region') or ''
    gallery_slug = photo.get('gallery_slug') or ''
    slug = photo.get('slug') or ''
    
    # Try species + location first
    if species and location and location not in ['Costa Rica', '']:
        return f"{species} at {location}"
    if species:
        return f"{species} in Costa Rica"
    
    # Try location from location_name
    if location and location not in ['Costa Rica', '']:
        return f"{location} Wildlife"
    
    # Try region
    if region and region not in ['Costa Rica', '']:
        return f"{region}, Costa Rica"
    
    # Try slug-derived
    words = slug.replace('-', ' ').replace('_', ' ').split()
    meaningful = [w.title() for w in words if w.lower() not in 
                  ('img', 'dsc', 'p', 'dji', 'pc', 'costa', 'rica', 'photo', 'photography', 'birds', 'bird', 'of', 'in') and len(w) > 2]
    if meaningful:
        return ' '.join(meaningful[:3])
    
    return None

def build_keywords(photo):
    """Build keywords from species, location, region."""
    parts = []
    species = photo.get('species_common_name') or ''
    location = photo.get('location_name') or ''
    region = photo.get('region') or ''
    country = photo.get('country') or 'Costa Rica'
    
    if species:
        parts.append(species)
        # Add common variants
        if 'macaw' in species.lower():
            parts.append('macaw bird')
            parts.append('wildlife photography')
        elif 'toucan' in species.lower():
            parts.append('toucan bird')
            parts.append('tropical bird')
        elif 'motmot' in species.lower():
            parts.append('motmot bird')
        elif 'quetzal' in species.lower():
            parts.append('quetzal bird')
            parts.append('resplendent quetzal')
    
    if location and location not in ['Costa Rica', '']:
        parts.append(location)
    if region and region not in ['Costa Rica', ''] and region != location:
        parts.append(region)
    parts.append(country)
    parts.append('wildlife photography')
    parts.append('nature photography')
    
    return ', '.join(parts)

def process_short_titles(conn, batch=100):
    """Fix photos with short/generic titles."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, slug, title, species_common_name, location_name, region, 
               country, gallery_slug, description, keywords
        FROM photos
        WHERE ready_for_public_render = true
          AND LENGTH(COALESCE(title, '')) < 15
        LIMIT %s
    """, (batch,))
    rows = cur.fetchall()
    
    improved = []
    for photo in rows:
        if not is_generic_title(photo.get('title') or ''):
            continue
        
        new_title = build_better_title(photo)
        if new_title and new_title != photo.get('title'):
            try:
                cur2 = conn.cursor()
                cur2.execute("UPDATE photos SET title = %s WHERE id = %s", (new_title, photo['id']))
                improved.append({
                    'id': photo['id'], 'slug': photo['slug'],
                    'old_title': photo['title'], 'new_title': new_title
                })
            except Exception as e:
                print(f"  Error updating title for {photo['id']}: {e}")
    
    conn.commit()
    cur.close()
    return improved

def process_missing_keywords(conn, batch=100):
    """Fill missing or sparse keywords from species/location data."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, slug, title, species_common_name, location_name, region,
               country, keywords
        FROM photos
        WHERE ready_for_public_render = true
          AND (keywords IS NULL OR keywords = '' OR 
               (position(',' in keywords) = 0 AND LENGTH(keywords) < 5))
        LIMIT %s
    """, (batch,))
    rows = cur.fetchall()
    
    improved = []
    for photo in rows:
        new_kw = build_keywords(photo)
        if new_kw and new_kw.strip():
            try:
                cur2 = conn.cursor()
                cur2.execute("UPDATE photos SET keywords = %s WHERE id = %s", (new_kw, photo['id']))
                improved.append({
                    'id': photo['id'], 'slug': photo['slug'],
                    'old_kw': photo['keywords'], 'new_kw': new_kw
                })
                conn.commit()
            except Exception as e:
                print(f"  Error updating keywords for {photo['id']}: {e}")
    
    return improved

def process_short_descriptions(conn, batch=100):
    """Fix descriptions that are too short or just location names."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, slug, title, description, location_name, region, country,
               species_common_name
        FROM photos
        WHERE ready_for_public_render = true
          AND description IS NOT NULL 
          AND LENGTH(description) BETWEEN 1 AND 50
        LIMIT %s
    """, (batch,))
    rows = cur.fetchall()
    
    improved = []
    for photo in rows:
        species = photo.get('species_common_name') or ''
        location = photo.get('location_name') or ''
        region = photo.get('region') or ''
        country = photo.get('country') or 'Costa Rica'
        
        loc_parts = [p for p in [location, region, country] if p and p not in (location,)]
        loc_str = ', '.join(loc_parts) if loc_parts else country
        
        new_desc = None
        if species and loc_str:
            new_desc = f"{species} photographed in {loc_str}. Part of the WildPhotography Costa Rica collection by Joshua ten Brink."
        elif loc_str:
            new_desc = f"Professional wildlife photograph from {loc_str}, {country}. Part of the WildPhotography collection by Joshua ten Brink."
        
        if new_desc and len(new_desc) >= 80:
            try:
                cur2 = conn.cursor()
                cur2.execute("UPDATE photos SET description = %s WHERE id = %s", (new_desc, photo['id']))
                improved.append({
                    'id': photo['id'], 'slug': photo['slug'],
                    'old_desc': (photo['description'] or '')[:50], 'new_desc': new_desc
                })
                conn.commit()
            except Exception as e:
                print(f"  Error updating description for {photo['id']}: {e}")
    
    return improved

if __name__ == '__main__':
    print("=== WildPhotography Metadata Quality Enrichment ===")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print()
    
    conn = connect()
    
    # Step 1: Short/generic titles
    print("--- Fixing short/generic titles ---")
    titles_fixed = process_short_titles(conn, batch=100)
    print(f"  Titles improved: {len(titles_fixed)}")
    for t in titles_fixed[:5]:
        print(f"    id={t['id']} '{t['old_title']}' -> '{t['new_title']}'")
    
    # Step 2: Missing/sparse keywords  
    print()
    print("--- Filling missing keywords ---")
    keywords_fixed = process_missing_keywords(conn, batch=100)
    print(f"  Keywords improved: {len(keywords_fixed)}")
    for k in keywords_fixed[:5]:
        print(f"    id={k['id']} '{k['old_kw']}' -> '{k['new_kw']}'")
    
    # Step 3: Short descriptions
    print()
    print("--- Fixing short descriptions ---")
    descs_fixed = process_short_descriptions(conn, batch=100)
    print(f"  Descriptions improved: {len(descs_fixed)}")
    for d in descs_fixed[:5]:
        print(f"    id={d['id']} '{d['old_desc']}' -> '{d['new_desc'][:60]}...'")
    
    conn.close()
    
    print()
    print("=== SUMMARY ===")
    total = len(titles_fixed) + len(keywords_fixed) + len(descs_fixed)
    print(f"Total improvements: {total}")
    print(f"  Titles fixed: {len(titles_fixed)}")
    print(f"  Keywords filled: {len(keywords_fixed)}")
    print(f"  Descriptions fixed: {len(descs_fixed)}")
    
    # Save result
    result = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'titles_fixed': len(titles_fixed),
        'keywords_fixed': len(keywords_fixed),
        'descriptions_fixed': len(descs_fixed),
        'total_improvements': total,
        'title_samples': titles_fixed[:5],
        'keyword_samples': keywords_fixed[:5],
        'desc_samples': descs_fixed[:5],
    }
    out = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/wild_metadata_quality_enrichment_result.json'
    with open(out, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\nResults saved: {out}")