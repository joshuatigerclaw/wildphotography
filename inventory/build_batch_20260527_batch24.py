#!/usr/bin/env python3
"""Build import batch - Batch 24 (2026-05-27): Nauyaca-Waterfalls, Flamingo-Beach, Rural-Costa-Rica"""
import os, json, hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_batch_next_5.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

targets = [
    {'folder': 'Costa-Rica-Gallery/Nauyaca-Waterfalls',      'gallery_id': 62, 'gallery_slug': 'nauyaca-waterfalls'},
    {'folder': 'Costa-Rica-Gallery/Flamingo-Beach',          'gallery_id': 33, 'gallery_slug': 'flamingo-beach'},
    {'folder': 'Costa-Rica-Gallery/Rural-Costa-Rica',       'gallery_id': 86, 'gallery_slug': 'rural-costa-rica'},
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
            'id': f'batch24_{content_hash[:16]}',
            'type': 'photo',
            'source_path': source_path,
            'gallery_folder': folder,
            'gallery_id': gallery_id,
            'gallery_slug': gallery_slug,
            'filename': filename,
            'content_hash': content_hash,
            'size': os.path.getsize(source_path),
            'approved': True,
            'priority': 60,
            'attempt_count': 0,
            'status': 'pending'
        }
        items.append(item)

print(f'Total items queued: {len(items)}')

with open(QUEUE_PATH, 'w') as f:
    json.dump(items, f, indent=2)

print(f'Saved to {QUEUE_PATH}')