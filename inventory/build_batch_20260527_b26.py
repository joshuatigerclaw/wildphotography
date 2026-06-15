#!/usr/bin/env python3
"""Build import batch 26 — Best-Pictures, South-America, Asia subfolders into existing galleries."""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# folder -> (gallery_id, gallery_slug)
# All slugs are confirmed existing in Neon
targets = [
    # South-America
    {'folder': 'South-America/Argentina',                          'gallery_id': 117, 'gallery_slug': 'south-america-argentina'},
    {'folder': 'South-America/Colombia-Cartagena-Islas-Baru',      'gallery_id': 118, 'gallery_slug': 'south-america-colombia-cartagena-islas-baru'},
    {'folder': 'South-America/Panama-',                            'gallery_id': 119, 'gallery_slug': 'south-america-panama'},
    {'folder': 'South-America/Peru',                              'gallery_id': 120, 'gallery_slug': 'south-america-peru'},
    # Asia
    {'folder': 'Asia/China',                                      'gallery_id': 103, 'gallery_slug': 'china'},
    {'folder': 'Asia/China-Shanghai',                              'gallery_id': 104, 'gallery_slug': 'china-shanghai'},
    # Best-Pictures (top-level generic, maps to favorites gallery id 102)
    {'folder': 'Best-Pictures',                                   'gallery_id': 102, 'gallery_slug': 'favorites'},
]

items = []
item_id = 0

for target in targets:
    folder = target['folder']
    gallery_id = target['gallery_id']
    gallery_slug = target['gallery_slug']
    folder_path = os.path.join(BASE, folder)

    if not os.path.isdir(folder_path):
        print(f'SKIP (not found): {folder}')
        continue

    image_files = sorted([
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])

    if not image_files:
        print(f'EMPTY: {folder}')
        continue

    print(f'Folder: {folder} ({len(image_files)} images)')

    for filename in image_files:
        source_path = os.path.join(folder_path, filename)
        if not os.path.exists(source_path):
            print(f'  WARN: source not found: {source_path}')
            continue
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()

        item = {
            'id': f'batch26_{folder.replace("/","_")}_{content_hash[:16]}',
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

print(f'\nTotal items queued: {len(items)}')
if items:
    print('Gallery breakdown:')
    from collections import Counter
    counts = Counter((item['gallery_folder'], item['gallery_slug']) for item in items)
    for (gf, gs), c in counts.most_common():
        print(f'  {c:3d}  {gf}  →  {gs}')

with open(QUEUE_PATH, 'w') as f:
    json.dump(items, f, indent=2)

print(f'Saved to {QUEUE_PATH}')
