#!/usr/bin/env python3
"""Build import batch - Batch 24b (2026-05-23): People-Watching, Potrero-Beach, Coyol-de-Alajuela, Bajos-del-Toro, San-Jose"""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# 5 galleries with very small local folder content OR low Neon count with high local count
targets = [
    {'folder': 'Costa-Rica-Gallery/People-Watching',                    'gallery_id': 68,  'gallery_slug': 'people-watching'},
    {'folder': 'Costa-Rica-Gallery/Potrero-Beach-Guanacaste',            'gallery_id': 75,  'gallery_slug': 'potrero-beach-guanacaste'},
    {'folder': 'Costa-Rica-Gallery/Coyol-de-Alajuela',                   'gallery_id': 29,  'gallery_slug': 'coyol-de-alajuela'},
    {'folder': 'Costa-Rica-Gallery/Bajos-del-Toro-Costa-Rica',           'gallery_id': 17,  'gallery_slug': 'bajos-del-toro-costa-rica'},
    {'folder': 'Costa-Rica-Gallery/San-Jose-Costa-Rica',                 'gallery_id': 146, 'gallery_slug': 'san-jose'},
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
    
    print(f'Folder: {folder} ({len(image_files)} images, queuing all)')
    
    for filename in image_files:
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