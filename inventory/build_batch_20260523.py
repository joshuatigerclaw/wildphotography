#!/usr/bin/env python3
"""Build import batch - Batch 24 (2026-05-23): Puntarenas, Perez-Zeledon, Random-Places, Isla-San-Lucas, Sports-and-Adventure"""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# 5 lowest photo count galleries with local folder matches on ADATA SC740
targets = [
    {'folder': 'Costa-Rica-Gallery/Puntarenas-Costa-Rica',                      'gallery_id': 145, 'gallery_slug': 'puntarenas'},
    {'folder': 'Costa-Rica-Gallery/Perez-Zeledon-San-Isidro-del-General',       'gallery_id': 69,  'gallery_slug': 'perez-zeledon-san-isidro-del-general'},
    {'folder': 'Costa-Rica-Gallery/Random-Places-of-Costa-Rica',                 'gallery_id': 82,  'gallery_slug': 'random-places-of-costa-rica'},
    {'folder': 'Costa-Rica-Gallery/Isla-San-Lucas-Puntarenas-Costa-Rica',      'gallery_id': 46,  'gallery_slug': 'isla-san-lucas-puntarenas-costa-rica'},
    {'folder': 'Costa-Rica-Gallery/Sports-and-Adventure',                       'gallery_id': 92,  'gallery_slug': 'sports-and-adventure'},
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