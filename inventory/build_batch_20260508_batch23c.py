#!/usr/bin/env python3
"""Build import batch - Batch 23c (2026-05-08): Peninsula-de-Osa, Puerto-Caldera, Samara, Rincon, Peninsula-de-Nicoya"""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# 5 folders mapped to existing Neon galleries
targets = [
    {'folder': 'Costa-Rica-Gallery/Peninsula-de-Osa',                 'gallery_id': 67, 'gallery_slug': 'peninsula-de-osa'},
    {'folder': 'Costa-Rica-Gallery/Puerto-Caldera-Puntarenas-Port', 'gallery_id': 78, 'gallery_slug': 'puerto-caldera-puntarenas-port'},
    {'folder': 'Costa-Rica-Gallery/Samara-Playa-Carillo',            'gallery_id': 87, 'gallery_slug': 'samara-playa-carillo'},
    {'folder': 'Costa-Rica-Gallery/Rincon-de-La-Vieja',              'gallery_id': 83, 'gallery_slug': 'rincon-de-la-vieja'},
    {'folder': 'Costa-Rica-Gallery/Peninsula-de-Nicoya',              'gallery_id': 66, 'gallery_slug': 'peninsula-de-nicoya'},
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
