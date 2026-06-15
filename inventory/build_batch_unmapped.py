#!/usr/bin/env python3
"""Build import batch from 5 unmapped Costa-Rica-Gallery folders."""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# 5 folders with existing Neon galleries, mapped by slug
targets = [
    {'folder': 'Costa-Rica-Gallery/Birds',                  'gallery_id': 5,   'gallery_slug': 'birds'},
    {'folder': 'Costa-Rica-Gallery/Flamingo-Beach',          'gallery_id': 33,  'gallery_slug': 'flamingo-beach'},
    {'folder': 'Costa-Rica-Gallery/Conchal-Guanacaste',      'gallery_id': 24,  'gallery_slug': 'conchal-guanacaste'},
    {'folder': 'Costa-Rica-Gallery/Papagayo-Bahia-Culebra',   'gallery_id': 64,  'gallery_slug': 'papagayo-bahia-culebra'},
    {'folder': 'Costa-Rica-Gallery/Punta-Leona',              'gallery_id': 80,  'gallery_slug': 'punta-leona'},
]

items = []
item_id = 0

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

    print(f'Folder: {folder} ({len(image_files)} images)')

    for filename in image_files:
        source_path = os.path.join(folder_path, filename)
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()

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
        item_id += 1

print(f'Total items queued: {len(items)}')

with open(QUEUE_PATH, 'w') as f:
    json.dump(items, f, indent=2)

print(f'Saved to {QUEUE_PATH}')
