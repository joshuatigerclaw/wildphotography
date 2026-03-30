#!/usr/bin/env python3
"""
WildPhotography Import Manager - Batch 20260327-02
Process up to 100 photos from remaining Costa-Rica-Gallery folders
Prioritizing: Birds (many more on disk), Papagayo, Isla-Tortuga, Escazu, Punta-Cacique
"""
import os
import json
import hashlib
import psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_OUT = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'
QUEUE_META = '/Users/joshuatenbrink/.openclaw/workspace/photo_import_pending_queue.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# 5 folders, up to 20 photos each = 100 max
# Targeting folders with significant unmapped content
targets = [
    {'folder': 'Costa-Rica-Gallery/Birds',                        'gallery_id': 5,   'gallery_slug': 'birds'},
    {'folder': 'Costa-Rica-Gallery/Papagayo-Bahia-Culebra',        'gallery_id': 64,  'gallery_slug': 'papagayo-bahia-culebra'},
    {'folder': 'Costa-Rica-Gallery/Isla-Tortuga',                  'gallery_id': 47,  'gallery_slug': 'isla-tortuga'},
    {'folder': 'Costa-Rica-Gallery/Escazu-Costa-Rica',             'gallery_id': 32,  'gallery_slug': 'escazu-costa-rica'},
    {'folder': 'Costa-Rica-Gallery/Punta-Cacique-Guancaste',       'gallery_id': 80,  'gallery_slug': 'punta-cacique-guancaste'},
]

def get_db_conn():
    return psycopg2.connect(NEON_CONN)

def get_existing_hashes(cur):
    """Get all content hashes already in the DB"""
    cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
    return set(row[0] for row in cur.fetchall())

def main():
    print("Building import batch 20260327-02...")
    
    conn = get_db_conn()
    cur = conn.cursor()
    
    existing_hashes = get_existing_hashes(cur)
    print(f"Existing DB hashes: {len(existing_hashes)}")
    
    items = []
    folder_stats = {}
    
    for target in targets:
        folder = target['folder']
        gallery_id = target['gallery_id']
        gallery_slug = target['gallery_slug']
        folder_path = os.path.join(BASE, folder)
        
        if not os.path.isdir(folder_path):
            print(f'SKIP: {folder} not found')
            continue
        
        image_files = sorted([
            f for f in os.listdir(folder_path)
            if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
        ])
        
        print(f"\nFolder: {folder} ({len(image_files)} images)")
        
        new_count = 0
        for filename in image_files[:20]:  # First 20 only for this batch
            source_path = os.path.join(folder_path, filename)
            with open(source_path, 'rb') as f:
                content_hash = hashlib.sha256(f.read()).hexdigest()
            
            is_dup = content_hash in existing_hashes
            
            item = {
                'id': f'ext_{folder.replace("/","_")}_{content_hash[:16]}',
                'type': 'photo',
                'source_path': source_path,
                'gallery_folder': folder,
                'gallery_id': gallery_id,
                'gallery_slug': gallery_slug,
                'filename': filename,
                'content_hash': content_hash,
                'size': os.path.getsize(source_path),
                'approved': True,
                'priority': 50,
                'attempt_count': 0,
                'status': 'skipped' if is_dup else 'pending',
                'skip_reason': 'duplicate' if is_dup else None
            }
            items.append(item)
            
            if is_dup:
                new_count += 0  # still counts for batch
            else:
                new_count += 1  # new photo
        
        folder_stats[folder] = {
            'total': len(image_files),
            'queued': min(20, len(image_files)),
            'new': new_count
        }
        print(f"  -> {len(image_files)} total files, queuing first {min(20, len(image_files))}, {new_count} new")
    
    # Save queue
    with open(QUEUE_OUT, 'w') as f:
        json.dump(items, f, indent=2)
    
    # Update metadata queue
    meta = {
        'queue_name': 'batch_next_import',
        'batch_type': 'local_import',
        'created_at': '2026-03-27T06:45:00.000Z',
        'last_run': None,
        'actionable_new_count': sum(s['new'] for s in folder_stats.values()),
        'duplicates_skipped': sum(s['queued'] - s['new'] for s in folder_stats.values()),
        'unresolved_count': 0,
        'batch_folders': list(folder_stats.keys()),
        'note': f'Batch 20260327-02: built from 5 folders. Folders: {list(folder_stats.keys())}',
        'external_drive_folders_total': 93,
        'external_drive_folders_imported': 93,
        'external_drive_folders_missing': ['Bajos-del-Toro-Costa-Rica', 'La-Garita-de-Alajuela'],
        'status': 'queued',
        'folders_processed': 0,
        'photos_imported_this_batch': 0,
        'next_action': 'run import_batch.py'
    }
    with open(QUEUE_META, 'w') as f:
        json.dump(meta, f, indent=2)
    
    cur.close()
    conn.close()
    
    print(f"\nBatch built: {len(items)} items queued")
    print(f"New photos: {sum(s['new'] for s in folder_stats.values())}")
    for folder, stats in folder_stats.items():
        print(f"  {folder}: {stats['new']} new / {stats['queued']} queued")

if __name__ == '__main__':
    main()
