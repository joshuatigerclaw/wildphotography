#!/usr/bin/env python3
"""Build a new import batch from unmapped Costa-Rica-Gallery folders."""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

targets = [
    {'folder': 'Costa-Rica-Gallery/Costa-Rica', 'gallery_id': 25, 'gallery_slug': 'costa-rica'},
    {'folder': 'Costa-Rica-Gallery/Best-of-Costa-Rica', 'gallery_id': 19, 'gallery_slug': 'best-of-costa-rica'},
    {'folder': 'Costa-Rica-Gallery/Wildlife', 'gallery_id': 6, 'gallery_slug': 'wildlife'},
    {'folder': 'Costa-Rica-Gallery/Arenal-Volcano', 'gallery_id': 16, 'gallery_slug': 'arenal-volcano'},
    {'folder': 'Costa-Rica-Gallery/Waterfalls-in-Costa-Rica', 'gallery_id': 100, 'gallery_slug': 'waterfalls-in-costa-rica'},
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
        item_id += 1

print(f'Total items queued: {len(items)}')

with open(QUEUE_PATH, 'w') as f:
    json.dump(items, f, indent=2)

print(f'Saved to {QUEUE_PATH}')
