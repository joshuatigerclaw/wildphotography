#!/usr/bin/env python3
"""
Content Quality Enricher for WildPhotography
Improves titles, descriptions, and metadata for photos flagged with content quality issues.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json
import re
from datetime import datetime, timezone

# Database connection
DB_URL = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require'

def is_generic_title(title):
    """Check if a title is a generic camera-generated filename."""
    if not title:
        return True
    # Patterns for generic camera filenames
    patterns = [
        r'^IMG[_\s]\d+.*$',   # IMG_2550, IMG 2550
        r'^DSC[_-]?\d+.*$',
        r'^P\d{5,}.*$',        # P4162148
        r'^DJI[_\s]\d+.*$',   # DJI_0589, DJI 0589
        r'^CL0A\d+.*$',
        r'^IMG\d+.*$',
        r'^P\d{6,}.*$',
        r'^PC3\d+.*$',
        r'^\d{4}[_-]\d{2}[_-]\d{2}[_-]\d{2}[_-]\d{2}[_-]\d{2}.*$',  # Date-based like 2020-11-28-07-06-35-beaches-1032
        r'^\d{4}-\d{2}-\d{2}\s+\d{2}\.\d{2}\.\d{2}.*$',  # 2019-04-16 10.32.59.jpg
    ]
    title_upper = title.upper()
    for pattern in patterns:
        if re.match(pattern, title, re.IGNORECASE):
            return True
    return False

def improve_title(photo, improved_count):
    """Improve a generic title based on available metadata."""
    slug = photo.get('slug', '')
    location_name = photo.get('location_name', '') or ''
    region = photo.get('region', '') or ''
    country = photo.get('country', '') or ''
    species = photo.get('species_common_name', '') or ''
    gallery_slug = photo.get('gallery_slug', '') or ''
    
    # Build a better title
    parts = []
    
    # Try to extract location from slug or location_name
    if location_name and location_name not in ['Costa Rica', '']:
        # Clean location name
        loc = location_name.replace('Pacific Coast, ', '').replace('Costa Rica ', '')
        if loc and loc != 'Costa Rica':
            parts.append(loc)
    
    # If no location from location_name, try region
    if not parts and region and region not in ['Costa Rica', '']:
        parts.append(region)
    
    # Add country
    if country and country != 'Costa Rica':
        parts.append(country)
    
    # Add species if available
    if species:
        parts.append(species)
    elif gallery_slug:
        # Try to extract meaningful slug part
        slug_words = slug.replace('-', ' ').replace('_', ' ').split()
        meaningful = [w for w in slug_words if w.lower() not in ['img', 'dsc', 'p', 'dji', 'pc', 'costa', 'rica', 'photo', 'photography'] and len(w) > 2]
        if meaningful:
            parts.extend(meaningful[:2])
    
    if not parts:
        parts = ['Costa Rica']
    
    # Capitalize each part
    parts = [p.title() if p.islower() else p for p in parts]
    
    improved_title = ' - '.join(parts) + ' Photography'
    
    # If still too generic, use slug-derived
    if len(improved_title) < 20:
        slug_words = [w.title() for w in slug.replace('-', ' ').replace('_', ' ').split() if w]
        if slug_words:
            improved_title = ' - '.join(slug_words[:3]) + ' Photography'
    
    return improved_title

def normalize_description(description, location_name, region):
    """Normalize and improve description."""
    if not description:
        return None
    
    # Clean up descriptions that are just locations
    if description == location_name or description == region:
        return None
    
    # Truncate overly long descriptions
    if len(description) > 500:
        description = description[:497] + '...'
    
    return description

def process_content_quality_items(batch_limit=500):
    """Main processing function."""
    improved_items = []
    unresolved_items = []
    
    conn = psycopg2.connect(DB_URL)
    
    # Load photos with needs_review = true that have content quality issues
    # These are photos with generic titles or missing metadata
    query = """
        SELECT id, slug, title, description, location_name, region, country,
               species_common_name, gallery_slug, metadata, keywords
        FROM photos
        WHERE needs_review = true
        LIMIT %s
    """
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, (batch_limit,))
        photos = cur.fetchall()
    
    print(f"Loaded {len(photos)} content quality items for review")
    
    for photo in photos:
        try:
            needs_improvement = False
            updates = {}
            
            # Check if title is generic
            if is_generic_title(photo.get('title')):
                new_title = improve_title(photo, len(improved_items))
                if new_title and new_title != photo.get('title'):
                    updates['title'] = new_title
                    needs_improvement = True
                    print(f"  Improving title for photo {photo['id']}: '{photo['title']}' -> '{new_title}'")
            
            # Check description
            if photo.get('description'):
                new_desc = normalize_description(
                    photo.get('description'),
                    photo.get('location_name', ''),
                    photo.get('region', '')
                )
                if new_desc is None and photo.get('description'):
                    # Clear the generic description
                    updates['description'] = None
                    needs_improvement = True
            
            # Only mark as improved if we made changes
            if needs_improvement:
                updates['db_id'] = photo['id']
                updates['slug'] = photo['slug']
                improved_items.append(updates)
            else:
                # Item doesn't need improvement, but may still need review
                # Requeue it as unresolved
                unresolved_items.append({
                    'id': f"photo_{photo['id']}",
                    'type': 'photo',
                    'db_id': photo['id'],
                    'slug': photo['slug'],
                    'title': photo.get('title', ''),
                    'reason': 'content_quality_issue'
                })
        
        except Exception as e:
            print(f"  Error processing photo {photo['id']}: {e}")
            unresolved_items.append({
                'id': f"photo_{photo['id']}",
                'type': 'photo',
                'db_id': photo['id'],
                'slug': photo.get('slug', ''),
                'title': photo.get('title', ''),
                'reason': 'content_quality_issue',
                'error': str(e)
            })
    
    # Write improvements to database
    updated_count = 0
    photo_ids = []
    with conn.cursor() as cur:
        for item in improved_items:
            if 'db_id' not in item:
                print(f"  WARNING: item missing db_id: {item}")
                continue
            photo_id = item['db_id']
            slug = item.get('slug', '')
            photo_ids.append(photo_id)
            
            if 'title' in item and item['title']:
                cur.execute(
                    "UPDATE photos SET title = %s WHERE id = %s",
                    (item['title'], photo_id)
                )
                updated_count += 1
            
            if 'description' in item:
                cur.execute(
                    "UPDATE photos SET description = %s WHERE id = %s",
                    (item['description'], photo_id)
                )
        
        conn.commit()
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE photos SET needs_review = false WHERE id = ANY(%s)",
                (photo_ids,)
            )
            conn.commit()
    
    conn.close()
    
    return {
        'loaded_count': len(photos),
        'improved_count': updated_count,
        'unresolved_count': len(unresolved_items),
        'improved_items': improved_items,
        'unresolved_items': unresolved_items
    }

if __name__ == '__main__':
    import sys
    batch_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    
    print(f"=== Content Quality Enricher ===")
    print(f"Batch limit: {batch_limit}")
    print()
    
    result = process_content_quality_items(batch_limit)
    
    print()
    print(f"=== Results ===")
    print(f"Items loaded: {result['loaded_count']}")
    print(f"Items improved: {result['improved_count']}")
    print(f"Items unresolved: {result['unresolved_count']}")
    
    # Save result
    output_path = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/wild_content_quality_enricher_result.json'
    with open(output_path, 'w') as f:
        json.dump({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            **result
        }, f, indent=2)
    print(f"\nResults saved to: {output_path}")