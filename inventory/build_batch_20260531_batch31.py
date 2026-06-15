#!/usr/bin/env python3
"""Build import batch - Batch 31 (2026-05-31): Costa-Rica-Gallery folders not yet imported"""
import os
import json
import hashlib
import psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/import_batch_active.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# Load existing hashes from Neon
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != ''")
existing_hashes = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f'Loaded {len(existing_hashes)} existing content hashes from Neon')

# Gallery folder -> (gallery_id, gallery_slug)
# Targeting folders NOT yet imported in recent batches
GALLERY_MAP = {
    'Costa-Rica-Gallery/Crocodiles':                                     (30,  'crocodiles'),
    'Costa-Rica-Gallery/Monkeys':                                        (59,  'monkeys'),
    'Costa-Rica-Gallery/Butterflies':                                     (22,  'butterflies'),
    'Costa-Rica-Gallery/Night-Photography':                               (63,  'night-photography'),
    'Costa-Rica-Gallery/Insects-and-Butterflies':                         (44,  'insects-and-butterflies'),
    'Costa-Rica-Gallery/Turtles':                                         (12,  'turtles'),
    'Costa-Rica-Gallery/Marine-Life-of-Costa-Rica':                       (58,  'marine-life-of-costa-rica'),
    'Costa-Rica-Gallery/Boats-in-Costa-Rica':                             (21,  'boats-in-costa-rica'),
    'Costa-Rica-Gallery/The-Ocean':                                        (99,  'the-ocean'),
    'Costa-Rica-Gallery/Isla-Tortuga':                                    (47,  'isla-tortuga'),
}

items = []
total_new = 0

for folder_rel, (gallery_id, gallery_slug) in GALLERY_MAP.items():
    folder = folder_rel
    folder_path = os.path.join(BASE, folder)
    
    if not os.path.isdir(folder_path):
        print(f'SKIP: {folder} not found')
        continue
    
    image_files = sorted([
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])
    
    new_in_folder = 0
    for filename in image_files:
        source_path = os.path.join(folder_path, filename)
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()
        
        if content_hash in existing_hashes:
            continue
        
        item = {
            'id': f'new_{folder.replace("/","_")}_{content_hash[:16]}',
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
            'status': 'pending'
        }
        items.append(item)
        new_in_folder += 1
        total_new += 1
    
    status = f'NEW:{new_in_folder}' if new_in_folder > 0 else 'SKIP:all dup'
    print(f'Folder: {folder} ({len(image_files)} files) -> {status}')

print(f'\nTotal new photos: {total_new}')

if items:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    print(f'Saved {len(items)} items to {QUEUE_PATH}')
else:
    print('No new photos found - all are duplicates')
