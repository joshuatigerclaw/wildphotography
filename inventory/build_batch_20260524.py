#!/usr/bin/env python3
"""Build import batch - Batch 25 (2026-05-24): Isla-Tortuga, Conchal, Playas-del-Coco, Las-Catalinas, Flamingo"""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# 5 galleries with local content not recently processed
targets = [
    {'folder': 'Costa-Rica-Gallery/Isla-Tortuga',                    'gallery_id': 47,  'gallery_slug': 'isla-tortuga',          'limit': 20},
    {'folder': 'Costa-Rica-Gallery/Conchal-Guanacaste',              'gallery_id': 24,  'gallery_slug': 'conchal-guanacaste',    'limit': 20},
    {'folder': 'Costa-Rica-Gallery/Playas-del-Coco',                 'gallery_id': 73,  'gallery_slug': 'playas-del-coco',      'limit': 20},
    {'folder': 'Costa-Rica-Gallery/Las-Catalinas-Guanacaste',       'gallery_id': 55,  'gallery_slug': 'las-catalinas-guanacaste', 'limit': 20},
    {'folder': 'Costa-Rica-Gallery/Flamingo-Beach',                 'gallery_id': 33,  'gallery_slug': 'flamingo-beach',       'limit': 20},
]

items = []

for target in targets:
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
    
    print(f'Folder: {folder} ({len(image_files)} images, queuing first {limit})')
    
    for filename in image_files[:limit]:
        source_path = os.path.join(folder_path, filename)
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()
        
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

print(f'Total items queued: {len(items)}')

with open(QUEUE_PATH, 'w') as f:
    json.dump(items, f, indent=2)

print(f'Saved to {QUEUE_PATH}')