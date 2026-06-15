#!/usr/bin/env python3
"""Build import batch - Batch 29 (2026-05-31): Scan all folders for NEW photos not in Neon"""
import os
import json
import hashlib

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/import_batch_active.json'

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# Load existing hashes from Neon
import psycopg2
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != ''")
existing_hashes = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f'Loaded {len(existing_hashes)} existing content hashes from Neon')

# Map folder -> (gallery_id, gallery_slug) for Costa-Rica-Gallery
GALLERY_MAP = {
    'Costa-Rica-Gallery/Forests-of-Costa-Rica': (38, 'forests-of-costa-rica'),
    'Costa-Rica-Gallery/The-Ocean': (99, 'the-ocean'),
    'Costa-Rica-Gallery/Isla-San-Lucas-Puntarenas-Costa-Rica': (46, 'isla-san-lucas-puntarenas-costa-rica'),
    'Costa-Rica-Gallery/Perez-Zeledon-San-Isidro-del-General': (69, 'perez-zeledon-san-isidro-del-general'),
    'Costa-Rica-Gallery/Playa-Hermosa-Jaco-Garabito': (71, 'playa-hermosa-jaco-garabito'),
    'Costa-Rica-Gallery/Alajuela': (13, 'alajuela'),
    'Costa-Rica-Gallery/Coyol-de-Alajuela': (108, 'coyol-de-alajuela'),
    'Costa-Rica-Gallery/San-Rafael-de-Alajuela': (123, 'san-rafael-de-alajuela'),
    'Costa-Rica-Gallery/Heredia-Costa-Rica': (42, 'heredia-costa-rica'),
    'Costa-Rica-Gallery/Puntarenas-Costa-Rica': (145, 'puntarenas'),
    'Costa-Rica-Gallery/San-Jose-Costa-Rica': (146, 'san-jose'),
    'Costa-Rica-Gallery/Jaco-Beach': (48, 'jaco-beach'),
    'Costa-Rica-Gallery/Limon-Puerto-Viejo-Cocles-Playa-Chiquita-y-Punta-Uva': (57, 'limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva'),
    'Costa-Rica-Gallery/Montezuma-Costa-Rica': (160, 'montezuma'),
    'Costa-Rica-Gallery/Tambor-Nicoya-Peninsula-Costa-Rica': (95, 'tambor-nicoya-peninsula-costa-rica'),
    'Costa-Rica-Gallery/Playa-Hermosa-Guanacaste': (70, 'playa-hermosa-guanacaste'),
    'Costa-Rica-Gallery/Flamingo-Beach': (33, 'flamingo-beach'),
    'Costa-Rica-Gallery/Rincon-de-La-Vieja': (83, 'rincon-de-la-vieja'),
    'Costa-Rica-Gallery/Nauyaca-Waterfalls': (62, 'nauyaca-waterfalls'),
    'Costa-Rica-Gallery/Santa-Teresa-Malpais': (91, 'santa-teresa-malpais'),
    'Costa-Rica-Gallery/Bajos-del-Toro-Costa-Rica': (17, 'bajos-del-toro-costa-rica'),
    'Costa-Rica-Gallery/Tarcoles-': (97, 'tarcoles'),
    'Costa-Rica-Gallery/The-Environment-': (98, 'the-environment'),
    'Costa-Rica-Gallery/La-Garita-de-Alajuela': (122, 'la-garita-de-alajuela'),
}

items = []
folders_checked = []
new_files_found = 0

for folder_rel, (gallery_id, gallery_slug) in GALLERY_MAP.items():
    folder = f'Costa-Rica-Gallery/{folder_rel.replace("Costa-Rica-Gallery/", "")}'
    folder_path = os.path.join(BASE, folder)
    
    if not os.path.isdir(folder_path):
        print(f'SKIP: {folder} not found')
        continue
    
    image_files = sorted([
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])
    
    folders_checked.append(f'{folder}: {len(image_files)} files')
    new_in_folder = 0
    
    for filename in image_files:
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
        new_in_folder += 1
        new_files_found += 1
    
    if new_in_folder > 0:
        print(f'Folder: {folder} -> {new_in_folder} NEW photos (of {len(image_files)} total)')

print(f'\nTotal new photos found: {new_files_found}')
print(f'Total items queued: {len(items)}')

if items:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    print(f'Saved to {QUEUE_PATH}')
else:
    print('No new photos found - all files are duplicates')