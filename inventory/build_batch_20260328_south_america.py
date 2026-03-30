#!/usr/bin/env python3
"""
WildPhotography Import Manager - South-America Batch Builder
Resume from interrupted 20260327-04 batch.
Processes: Argentina (remaining), Colombia, Panama, Peru
Limit: 100 photos
"""
import os
import json
import hashlib
import psycopg2
from datetime import datetime, timezone

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries/South-America'
QUEUE_OUT = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'
QUEUE_META_OUT = '/Users/joshuatenbrink/.openclaw/workspace/photo_import_pending_queue.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')
BATCH_LIMIT = 100

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# Gallery mapping: folder name -> (gallery_id, gallery_slug)
GALLERY_MAP = {
    'Argentina': (117, 'south-america-argentina'),
    'Colombia-Cartagena-Islas-Baru': (118, 'south-america-colombia-cartagena-islas-baru'),
    'Panama-': (119, 'south-america-panama'),
    'Peru': (120, 'south-america-peru'),
}

def get_db_conn():
    return psycopg2.connect(NEON_CONN)

def get_existing_hashes(cur):
    cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
    return set(row[0] for row in cur.fetchall())

def scan_folder(folder_name, existing_hashes):
    """Scan folder and return list of (filepath, filename, content_hash) for new files."""
    folder_path = os.path.join(BASE, folder_name)
    if not os.path.isdir(folder_path):
        print(f'  SKIP: {folder_path} not found')
        return []
    
    image_files = sorted([
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])
    
    print(f'  Scanning {len(image_files)} files in {folder_name}...')
    
    results = []
    new_count = 0
    for filename in image_files:
        source_path = os.path.join(folder_path, filename)
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()
        
        if content_hash in existing_hashes:
            print(f'    [DUP] {filename}')
        else:
            results.append((source_path, filename, content_hash))
            new_count += 1
            if new_count % 50 == 0:
                print(f'    ... {new_count} new so far')
    
    print(f'  {folder_name}: {len(image_files)} total, {new_count} new, {len(image_files)-new_count} duplicates')
    return results

def main():
    ts = datetime.now(timezone.utc).isoformat()
    print("Building South-America import batch (20260328-01)...")
    print(f"Batch limit: {BATCH_LIMIT} photos")
    
    conn = get_db_conn()
    cur = conn.cursor()
    
    existing_hashes = get_existing_hashes(cur)
    print(f"Existing DB hashes: {len(existing_hashes)}")
    
    all_new = []
    folder_results = {}
    
    folders = ['Argentina', 'Colombia-Cartagena-Islas-Baru', 'Panama-', 'Peru']
    for folder in folders:
        print(f"\nFolder: {folder}")
        new_files = scan_folder(folder, existing_hashes)
        folder_results[folder] = new_files
        all_new.extend(new_files)
    
    # Limit to batch limit
    batch_items = all_new[:BATCH_LIMIT]
    remaining = all_new[BATCH_LIMIT:]
    
    print(f"\nTotal new files found: {len(all_new)}")
    print(f"Batch limit: {BATCH_LIMIT}")
    print(f"Included in this batch: {len(batch_items)}")
    print(f"Will queue for next batch: {len(remaining)}")
    
    # Build items
    items = []
    gallery_id_map = dict(GALLERY_MAP)
    
    for i, (source_path, filename, content_hash) in enumerate(batch_items):
        # Determine folder from path
        folder_name = None
        for fn in folders:
            if fn in source_path:
                folder_name = fn
                break
        
        gallery_id, gallery_slug = gallery_id_map.get(folder_name, (117, 'south-america-argentina'))
        
        item = {
            'id': f'sa_20260328_{content_hash[:12]}',
            'type': 'photo',
            'source_path': source_path,
            'gallery_folder': f'South-America/{folder_name}',
            'gallery_id': gallery_id,
            'gallery_slug': gallery_slug,
            'filename': filename,
            'content_hash': content_hash,
            'size': os.path.getsize(source_path),
            'approved': True,
            'priority': 50,
            'attempt_count': 0,
            'status': 'pending'
        }
        items.append(item)
    
    # Save batch queue
    with open(QUEUE_OUT, 'w') as f:
        json.dump(items, f, indent=2)
    print(f"\nSaved {len(items)} items to {QUEUE_OUT}")
    
    # Save metadata about remaining work
    folders_remaining = {}
    for folder in folders:
        folders_remaining[folder] = {
            'total': len(folder_results.get(folder, [])),
            'included': len([x for x in batch_items if folder in x[0]]),
        }
    
    remaining_info = []
    for folder in folders:
        fr = folder_results.get(folder, [])
        in_batch = len([x for x in batch_items if folder in x[0]])
        rem = len(fr) - in_batch
        if rem > 0:
            remaining_info.append(f"South-America/{folder} ({rem} remaining)")
    
    meta = {
        'queue_name': 'batch_next_import',
        'batch_type': 'south_america_resume',
        'created_at': ts,
        'status': 'ready_to_run',
        'note': f'South-America batch (20260328-01). {len(items)} items from Argentina (partial), Colombia, Panama, Peru. {len(remaining)} overflow for next batch.',
        'batch_folders_remaining': remaining_info,
        'folders_processed': len(folders),
        'folders_in_batch': list(folders),
        'actionable_new_count': len(all_new) - len(batch_items),
        'batch_limit_applied': BATCH_LIMIT,
    }
    
    with open(QUEUE_META_OUT, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f"Saved batch metadata to {QUEUE_META_OUT}")
    
    conn.close()
    print("\nBatch build complete!")

if __name__ == '__main__':
    main()
