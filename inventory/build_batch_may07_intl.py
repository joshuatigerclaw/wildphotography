#!/usr/bin/env python3
"""
Build import batch from international folders - May 7.
Scans Asia/China, Asia/China-Shanghai, Europe/France, South-America/Peru, South-America/Argentina
"""
import os
import json
import hashlib
import psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

targets = [
    {'folder': 'Asia/China',                  'gallery_id': 111, 'gallery_slug': 'asia-china'},
    {'folder': 'Asia/China-Shanghai',          'gallery_id': 112, 'gallery_slug': 'asia-china-shanghai'},
    {'folder': 'Europe/France',                'gallery_id': 113, 'gallery_slug': 'europe-france'},
    {'folder': 'South-America/Peru',            'gallery_id': 120, 'gallery_slug': 'south-america-peru'},
    {'folder': 'South-America/Argentina',       'gallery_id': 117, 'gallery_slug': 'south-america-argentina'},
]

# Connect to DB and get all existing content hashes
print("Loading existing content hashes from Neon...")
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
existing_hashes = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f"  Existing hashes in DB: {len(existing_hashes)}")

items = []
total_files = 0
total_new = 0
total_dup = 0
total_missing = 0

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

    print(f'\nFolder: {folder} ({len(image_files)} files)')

    folder_new = 0
    folder_dup = 0

    for filename in image_files:
        source_path = os.path.join(folder_path, filename)
        total_files += 1

        if not os.path.exists(source_path):
            total_missing += 1
            continue

        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()

        if content_hash in existing_hashes:
            folder_dup += 1
            total_dup += 1
        else:
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
                'status': 'pending'
            }
            items.append(item)
            folder_new += 1
            total_new += 1

    print(f'  New: {folder_new}, Duplicates: {folder_dup}')

print(f'\nTotal: files={total_files}, new={total_new}, dup={total_dup}, missing={total_missing}')

if items:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    print(f'Saved {len(items)} items to {QUEUE_PATH}')
else:
    with open(QUEUE_PATH, 'w') as f:
        json.dump([], f)
    print('No new items found - all files are duplicates. Queue cleared.')