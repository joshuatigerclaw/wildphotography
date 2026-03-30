#!/usr/bin/env python3
"""
WildPhotography Search Card Thumbnail Audit
Compares thumb_url between DB and Typesense for indexed photos.
"""

import json
import requests
from psycopg2 import connect
from psycopg2.extras import RealDictCursor

# Neon connection
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# Typesense config
TYPESENSE_HOST = "uibn03zvateqwdx2p-1.a1.typesense.net"
TYPESENSE_KEY = "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"

BATCH_LIMIT = 500

def query_db(sql):
    """Execute SQL query and return results."""
    conn = connect(NEON_CONN)
    conn.autocommit = True
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql)
        results = cur.fetchall()
    conn.close()
    return [dict(r) for r in results]

def get_typesense_docs(limit=500):
    """Export all photo documents from Typesense."""
    url = f"https://{TYPESENSE_HOST}/collections/photos/documents/export"
    params = {"include_fields": "id,slug,title,thumb_url,canonical_url"}
    headers = {"X-Typesense-Api-Key": TYPESENSE_KEY}
    
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=60)
        if resp.status_code != 200:
            print(f"Typesense export error: {resp.status_code} {resp.text}")
            return []
        
        lines = resp.text.strip().split('\n')
        docs = []
        for line in lines:
            if line.strip():
                try:
                    docs.append(json.loads(line))
                except:
                    pass
        return docs[:limit]
    except Exception as e:
        print(f"Typesense export error: {e}")
        return []

def construct_canonical_url(slug):
    """Construct canonical URL from slug."""
    return f"https://www.wildphotography.com/photo/{slug}"

def main():
    print("=== WildPhotography Search Card Thumbnail Audit ===")
    
    # 1. Load indexed photos from DB
    print("\n[1] Loading indexed photos from DB...")
    db_photos = query_db(f"""
        SELECT id, slug, title, thumb_url
        FROM photos
        WHERE search_ready = true
          AND ready_for_public_render = true
          AND title IS NOT NULL AND title != ''
          AND slug IS NOT NULL AND slug != ''
          AND thumb_url IS NOT NULL AND thumb_url != ''
        LIMIT {BATCH_LIMIT}
    """)
    db_count = len(db_photos)
    print(f"  DB indexed photos: {db_count}")
    
    # Index by id
    db_by_id = {p['id']: p for p in db_photos}
    
    # 2. Load docs from Typesense
    print("\n[2] Loading documents from Typesense...")
    ts_docs = get_typesense_docs(BATCH_LIMIT)
    ts_count = len(ts_docs)
    print(f"  Typesense docs: {ts_count}")
    
    # Index by id (Typesense uses string ids, DB uses integer)
    ts_by_id = {int(d['id']) if str(d['id']).isdigit() else d['id']: d for d in ts_docs}
    
    # 3. Compare mapping
    print("\n[3] Validating search card mapping...")
    
    failures = []
    db_only = []
    ts_only = []
    thumb_mismatches = []
    slug_mismatches = []
    title_mismatches = []
    
    # Check DB records against Typesense
    for photo_id, db_photo in db_by_id.items():
        if photo_id not in ts_by_id:
            db_only.append({
                'id': photo_id,
                'slug': db_photo['slug'],
                'title': db_photo['title'],
                'thumb_url': db_photo['thumb_url'],
                'issue': 'in_db_not_in_typesense'
            })
        else:
            ts_doc = ts_by_id[photo_id]
            # Check thumb_url match
            db_thumb = db_photo.get('thumb_url') or ''
            ts_thumb = ts_doc.get('thumb_url') or ''
            if db_thumb != ts_thumb:
                thumb_mismatches.append({
                    'id': photo_id,
                    'slug': db_photo['slug'],
                    'title': db_photo['title'],
                    'db_thumb_url': db_thumb,
                    'ts_thumb_url': ts_thumb,
                    'issue': 'thumb_url_mismatch'
                })
            # Check slug match
            db_slug = db_photo.get('slug') or ''
            ts_slug = ts_doc.get('slug') or ''
            if db_slug != ts_slug:
                slug_mismatches.append({
                    'id': photo_id,
                    'db_slug': db_slug,
                    'ts_slug': ts_slug,
                    'issue': 'slug_mismatch'
                })
            # Check title match
            db_title = db_photo.get('title') or ''
            ts_title = ts_doc.get('title') or ''
            if db_title != ts_title:
                title_mismatches.append({
                    'id': photo_id,
                    'db_title': db_title,
                    'ts_title': ts_title,
                    'issue': 'title_mismatch'
                })
    
    # Check Typesense-only docs
    for doc_id, ts_doc in ts_by_id.items():
        if doc_id not in db_by_id:
            ts_only.append({
                'id': doc_id,
                'slug': ts_doc.get('slug', ''),
                'title': ts_doc.get('title', ''),
                'thumb_url': ts_doc.get('thumb_url', ''),
                'issue': 'in_typesense_not_in_db'
            })
    
    failures = db_only + ts_only + thumb_mismatches
    
    # 4. Summary
    print(f"\n=== Summary ===")
    print(f"  Indexed records checked: {db_count}")
    print(f"  Typesense docs checked: {ts_count}")
    print(f"  Mapping failures: {len(failures)}")
    print(f"    - In DB not Typesense: {len(db_only)}")
    print(f"    - In Typesense not DB: {len(ts_only)}")
    print(f"    - thumb_url mismatches: {len(thumb_mismatches)}")
    print(f"  Other discrepancies:")
    print(f"    - slug mismatches: {len(slug_mismatches)}")
    print(f"    - title mismatches: {len(title_mismatches)}")
    
    # 5. Return structured result
    result = {
        'indexed_records_checked': db_count,
        'typesense_docs_checked': ts_count,
        'mapping_failures': len(failures),
        'db_only_count': len(db_only),
        'ts_only_count': len(ts_only),
        'thumb_mismatch_count': len(thumb_mismatches),
        'slug_mismatch_count': len(slug_mismatches),
        'title_mismatch_count': len(title_mismatches),
        'failures': failures[:50],  # Cap for output
        'thumb_mismatches_sample': thumb_mismatches[:10],
        'slug_mismatches_sample': slug_mismatches[:5],
        'title_mismatches_sample': title_mismatches[:5],
    }
    
    print(f"\n[5] Audit complete.")
    print(json.dumps(result, indent=2))
    
    return result

if __name__ == '__main__':
    main()
