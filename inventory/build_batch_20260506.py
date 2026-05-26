#!/usr/bin/env python3
"""Build import batch - Batch 3 (2026-05-06): Jaco-Beach, Turtles, Butterflies, Crocodiles, Monkeys"""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

targets = [
    {'folder': 'Costa-Rica-Gallery/Jaco-Beach',       'gallery_id': 48, 'gallery_slug': 'jaco-beach'},
    {'folder': 'Costa-Rica-Gallery/Turtles',           'gallery_id': 12, 'gallery_slug': 'turtles'},
    {'folder': 'Costa-Rica-Gallery/Butterflies',       'gallery_id': 22, 'gallery_slug': 'butterflies'},
    {'folder': 'Costa-Rica-Gallery/Crocodiles',        'gallery_id': 30, 'gallery_slug': 'crocodiles'},
    {'folder': 'Costa-Rica-Gallery/Monkeys',           'gallery_id': 59, 'gallery_slug': 'monkeys'},
]

items = []

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
    
    print(f'Folder: {folder} ({len(image_files)} images, queuing first 20)')
    
    for filename in image_files[:20]:
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

print(f'Total items queued: {len(items)}')

with open(QUEUE_PATH, 'w') as f:
    json.dump(items, f, indent=2)

print(f'Saved to {QUEUE_PATH}')
