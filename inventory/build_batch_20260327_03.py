#!/usr/bin/env python3
"""
WildPhotography Import Manager - Batch 20260327-03
Process up to 100 photos from large Costa-Rica-Gallery folders
Targeting: Tambor (598), Beaches (424), Best-of-Costa-Rica (333), Wildlife (211), Conchal-Guanacaste (155)
Skipping: Birds (670 already fully indexed from prior batch)
"""
import os
import json
import hashlib
import psycopg2
from datetime import datetime, timezone

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries/Costa-Rica-Gallery'
QUEUE_OUT = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'
QUEUE_META_OUT = '/Users/joshuatenbrink/.openclaw/workspace/photo_import_pending_queue.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# Gallery slug mapping for these folders
GALLERY_MAP = {
    'Tambor-Nicoya-Peninsula-Costa-Rica': {'gallery_id': 47, 'gallery_slug': 'tambor-nicoya-peninsula'},
    'Beaches': {'gallery_id': 13, 'gallery_slug': 'beaches-costa-rica'},
    'Best-of-Costa-Rica': {'gallery_id': 2, 'gallery_slug': 'best-of-costa-rica'},
    'Wildlife': {'gallery_id': 14, 'gallery_slug': 'wildlife'},
    'Conchal-Guanacaste': {'gallery_id': 63, 'gallery_slug': 'conchal-guanacaste'},
}

targets = [
    'Tambor-Nicoya-Peninsula-Costa-Rica',
    'Beaches',
    'Best-of-Costa-Rica',
    'Wildlife',
    'Conchal-Guanacaste',
]

def get_db_conn():
    return psycopg2.connect(NEON_CONN)

def get_existing_hashes(cur):
    """Get all content hashes already in the DB"""
    cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
    return set(row[0] for row in cur.fetchall())

def main():
    ts = datetime.now(timezone.utc).isoformat()
    print("Building import batch 20260327-03...")
    
    conn = get_db_conn()
    cur = conn.cursor()
    
    existing_hashes = get_existing_hashes(cur)
    print(f"Existing DB hashes: {len(existing_hashes)}")
    
    items = []
    folder_stats = {}
    
    for folder in targets:
        folder_path = os.path.join(BASE, folder)
        
        if not os.path.isdir(folder_path):
            print(f'SKIP: {folder} not found')
            continue
        
        image_files = sorted([
            f for f in os.listdir(folder_path)
            if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
        ])
        
        print(f"\nFolder: {folder} ({len(image_files)} total images)")
        
        g = GALLERY_MAP.get(folder, {'gallery_id': None, 'gallery_slug': folder.lower()})
        gallery_id = g['gallery_id']
        gallery_slug = g['gallery_slug']
        
        new_count = 0
        dup_count = 0
        
        for filename in image_files[:20]:  # First 20 only for this batch
            source_path = os.path.join(folder_path, filename)
            with open(source_path, 'rb') as f:
                content_hash = hashlib.sha256(f.read()).hexdigest()
            
            is_dup = content_hash in existing_hashes
            
            item = {
                'id': f'ext_{folder}_{content_hash[:16]}',
                'type': 'photo',
                'source_path': source_path,
                'gallery_folder': f'Costa-Rica-Gallery/{folder}',
                'gallery_id': gallery_id,
                'gallery_slug': gallery_slug,
                'filename': filename,
                'content_hash': content_hash,
                'size': os.path.getsize(source_path),
                'approved': True,
                'priority': 50,
                'attempt_count': 0,
                'status': 'pending' if not is_dup else 'skipped',
                'skip_reason': 'duplicate' if is_dup else None
            }
            items.append(item)
            
            if is_dup:
                dup_count += 1
            else:
                new_count += 1
        
        folder_stats[folder] = {
            'total': len(image_files),
            'queued': min(20, len(image_files)),
            'new': new_count,
            'duplicates': dup_count
        }
        print(f"  -> {len(image_files)} total, queuing first {min(20, len(image_files))}, {new_count} new, {dup_count} duplicates")
    
    cur.close()
    conn.close()
    
    total_new = sum(s['new'] for s in folder_stats.values())
    total_dups = sum(s['duplicates'] for s in folder_stats.values())
    
    # Save queue
    with open(QUEUE_OUT, 'w') as f:
        json.dump(items, f, indent=2)
    
    # Update metadata queue
    meta = {
        'queue_name': 'batch_next_import',
        'batch_type': 'local_import',
        'created_at': ts,
        'last_run': None,
        'actionable_new_count': total_new,
        'duplicates_skipped': total_dups,
        'unresolved_count': 0,
        'batch_folders': list(folder_stats.keys()),
        'note': f'Batch 20260327-03: {len(items)} items from {len(folder_stats)} folders. {total_new} new, {total_dups} duplicates.',
        'external_drive_folders_total': 93,
        'external_drive_folders_imported': 93,
        'external_drive_folders_missing': ['Bajos-del-Toro-Costa-Rica', 'La-Garita-de-Alajuela'],
        'status': 'built',
        'folders_processed': 0,
        'photos_imported_this_batch': 0,
        'next_action': 'run_import_batch'
    }
    with open(QUEUE_META_OUT, 'w') as f:
        json.dump(meta, f, indent=2)
    
    print(f"\nBatch built: {len(items)} total items")
    print(f"New photos: {total_new}, Duplicates: {total_dups}")
    for folder, stats in folder_stats.items():
        print(f"  {folder}: {stats['new']} new / {stats['queued']} queued ({stats['total']} total in folder)")

if __name__ == '__main__':
    main()
