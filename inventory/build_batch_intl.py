#!/usr/bin/env python3
"""Build import batch - International galleries (existing Neon galleries only)"""
import os, json, hashlib, psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/import_batch_active.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()

cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != ''")
existing_hashes = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f'Loaded {len(existing_hashes)} existing hashes from Neon')

# Existing international galleries in Neon
INTL_GALLERIES = [
    ('South-America/Argentina',                            117, 'south-america-argentina'),
    ('South-America/Peru',                                120, 'south-america-peru'),
    ('South-America/Colombia-Cartagena-Islas-Baru',       118, 'south-america-colombia-cartagena-islas-baru'),
    ('South-America/Panama-',                             119, 'south-america-panama'),
    ('Asia/China',                                        103, 'china'),
    ('Asia/China-Shanghai',                               104, 'china-shanghai'),
    ('Europe/France',                                     113, 'europe-france'),
    ('Mexico/Cancun-Isla-Mujeres-Playa-del-Carmen-Conzumel', 143, 'mexico'),
]

items = []
total_new = 0

for folder_rel, gallery_id, gallery_slug in INTL_GALLERIES:
    folder_path = os.path.join(BASE, folder_rel)
    if not os.path.isdir(folder_path):
        print(f'SKIP: {folder_rel} not found')
        continue
    
    image_files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(EXTENSIONS) and not f.startswith('._')])
    new_in_folder = 0
    
    for filename in image_files[:300]:
        source_path = os.path.join(folder_path, filename)
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()
        
        if content_hash in existing_hashes:
            continue
        
        item = {
            'id': f'new_{folder_rel.replace("/","_")}_{content_hash[:16]}',
            'type': 'photo',
            'source_path': source_path,
            'gallery_folder': folder_rel,
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
    
    print(f'{folder_rel}: {len(image_files)} local, {new_in_folder} NEW')
    if total_new >= 100:
        break

print(f'\nTotal new photos: {total_new}')

if items:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    print(f'Saved {len(items)} items to {QUEUE_PATH}')
else:
    print('No new photos found - all files are duplicates')