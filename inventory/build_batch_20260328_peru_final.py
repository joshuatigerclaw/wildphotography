#!/usr/bin/env python3
"""
WildPhotography Import Manager - Peru Final Batch
254 - 100 done = 154 remaining
"""
import os
import json
import hashlib
import psycopg2
from datetime import datetime, timezone

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries/South-America/Peru'
QUEUE_OUT = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'
QUEUE_META_OUT = '/Users/joshuatenbrink/.openclaw/workspace/photo_import_pending_queue.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')
BATCH_LIMIT = 100

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

GALLERY_ID = 120
GALLERY_SLUG = 'south-america-peru'

def get_db_conn():
    return psycopg2.connect(NEON_CONN)

def get_existing_hashes(cur):
    cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
    return set(row[0] for row in cur.fetchall())

def main():
    ts = datetime.now(timezone.utc).isoformat()
    print("Building Peru final import batch (20260328-04)...")
    
    conn = get_db_conn()
    cur = conn.cursor()
    existing_hashes = get_existing_hashes(cur)
    print(f"Existing DB hashes: {len(existing_hashes)}")
    
    image_files = sorted([
        f for f in os.listdir(BASE)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])
    
    all_new = []
    for filename in image_files:
        source_path = os.path.join(BASE, filename)
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()
        if content_hash not in existing_hashes:
            all_new.append((source_path, filename, content_hash))
    
    print(f"New Peru files remaining: {len(all_new)}")
    
    batch_items = all_new[:BATCH_LIMIT]
    remaining = all_new[BATCH_LIMIT:]
    
    items = []
    for i, (source_path, filename, content_hash) in enumerate(batch_items):
        item = {
            'id': f'peru4_20260328_{content_hash[:12]}',
            'type': 'photo',
            'source_path': source_path,
            'gallery_folder': 'South-America/Peru',
            'gallery_id': GALLERY_ID,
            'gallery_slug': GALLERY_SLUG,
            'filename': filename,
            'content_hash': content_hash,
            'size': os.path.getsize(source_path),
            'approved': True,
            'priority': 50,
            'attempt_count': 0,
            'status': 'pending'
        }
        items.append(item)
    
    with open(QUEUE_OUT, 'w') as f:
        json.dump(items, f, indent=2)
    print(f"Saved {len(items)} items to {QUEUE_OUT}")
    
    meta = {
        'queue_name': 'batch_next_import',
        'batch_type': 'south_america_peru_final',
        'created_at': ts,
        'status': 'ready_to_run',
        'note': f'Peru final batch (20260328-04). {len(items)} items this batch. {len(remaining)} overflow for next batch.',
        'batch_folders_remaining': [f"South-America/Peru ({len(remaining)} remaining)"] if remaining else [],
        'folders_processed': 0,
        'folders_in_batch': ['Peru'],
        'actionable_new_count': len(remaining),
        'batch_limit_applied': BATCH_LIMIT,
    }
    
    with open(QUEUE_META_OUT, 'w') as f:
        json.dump(meta, f, indent=2)
    
    conn.close()
    print(f"Batch build complete! Remaining for next: {len(remaining)}")

if __name__ == '__main__':
    main()
