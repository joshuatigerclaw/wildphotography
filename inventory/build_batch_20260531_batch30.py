#!/usr/bin/env python3
"""Build import batch - Batch 30 (2026-05-31): Scan galleries with large local/Neon gaps for NEW photos"""
import os
import json
import hashlib
import psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/import_batch_active.json'
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# Load all content hashes from Neon (both 32 and 64 char)
conn = psycopg2.connect('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require')
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != ''")
existing_hashes = set()
for row in cur.fetchall():
    existing_hashes.add(row[0])
    # Also store first 16 chars for 32-char hash lookups
cur.close()
conn.close()
print(f'Loaded {len(existing_hashes)} existing content hashes from Neon')

# Galleries with known gaps from our analysis
TARGETS = [
    {'folder': 'Costa-Rica-Gallery/Tambor-Nicoya-Peninsula-Costa-Rica',        'gallery_id': 95,  'gallery_slug': 'tambor-nicoya-peninsula-costa-rica',     'limit': 100},
    {'folder': 'Costa-Rica-Gallery/Jaco-Beach',                               'gallery_id': 48,  'gallery_slug': 'jaco-beach',                            'limit': 100},
    {'folder': 'Costa-Rica-Gallery/Limon-Puerto-Viejo-Cocles-Playa-Chiquita-y-Punta-Uva', 'gallery_id': 57, 'gallery_slug': 'limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva', 'limit': 100},
    {'folder': 'Costa-Rica-Gallery/Sunrise-Sunset',                           'gallery_id': 93,  'gallery_slug': 'sunrise-sunset',                       'limit': 100},
    {'folder': 'Costa-Rica-Gallery/Puntarenas-Costa-Rica',                    'gallery_id': 81,  'gallery_slug': 'puntarenas-costa-rica',                 'limit': 100},
]

items = []
total_new = 0

for target in TARGETS:
    folder = target['folder']
    gallery_id = target['gallery_id']
    gallery_slug = target['gallery_slug']
    limit = target['limit']
    folder_path = os.path.join(BASE, folder)
    
    if not os.path.isdir(folder_path):
        print(f'SKIP: {folder} not found')
        continue
    
    image_files = sorted([
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])
    
    folder_new = 0
    for filename in image_files:
        if folder_new >= limit:
            break
        
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
        folder_new += 1
    
    print(f'Folder: {folder} -> {folder_new} NEW photos (of {len(image_files)} total)')
    total_new += folder_new

print(f'\nTotal new photos queued: {total_new}')

if items:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    print(f'Saved {len(items)} items to {QUEUE_PATH}')
else:
    print('No new photos found - all files are duplicates')