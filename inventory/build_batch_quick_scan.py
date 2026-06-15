#!/usr/bin/env python3
"""Build import batch - Quick scan of high-value unmapped galleries"""
import os, json, hashlib, psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/import_batch_active.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()

# Load existing hashes from Neon
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != ''")
existing_hashes = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f'Loaded {len(existing_hashes)} existing hashes from Neon')

# Galleries to scan - high file count Costa Rica galleries not recently batched
TARGETS = [
    ('Costa-Rica-Gallery/Birds',              5,  'birds'),
    ('Costa-Rica-Gallery/Isla-Tortuga',       47,  'isla-tortuga'),
    ('Costa-Rica-Gallery/Food-',              37,  'food'),
    ('Costa-Rica-Gallery/Wildlife',            6,  'wildlife'),
    ('Costa-Rica-Gallery/Papagayo-Bahia-Culebra', 64, 'papagayo-bahia-culebra'),
    ('Costa-Rica-Gallery/Playas-del-Coco',    73,  'playas-del-coco'),
    ('Costa-Rica-Gallery/Flamingo-Beach',     33,  'flamingo-beach'),
    ('Costa-Rica-Gallery/Tamarindo-Guanacaste-Costa-Rica', 94, 'tamarindo-guanacaste-costa-rica'),
    ('Costa-Rica-Gallery/Best-of-Costa-Rica', 19,  'best-of-costa-rica'),
    ('Costa-Rica-Gallery/Beaches',            18,  'beaches'),
]

items = []
total_new = 0

for folder, gallery_id, gallery_slug in TARGETS:
    folder_path = os.path.join(BASE, folder)
    if not os.path.isdir(folder_path):
        print(f'SKIP: {folder} not found')
        continue
    
    image_files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(EXTENSIONS) and not f.startswith('._')])
    new_in_folder = 0
    
    for filename in image_files[:200]:  # Check first 200 per folder
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
    
    print(f'{folder}: {len(image_files)} local, {new_in_folder} NEW')
    if new_in_folder >= 100:
        break

print(f'\nTotal new photos: {total_new}')

if items:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    print(f'Saved {len(items)} items to {QUEUE_PATH}')
else:
    print('No new photos found')