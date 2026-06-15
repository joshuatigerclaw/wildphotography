#!/usr/bin/env python3
"""
Build import batch - May 24 fresh scan
Scans Costa-Rica-Gallery folders, hashes files, dedupes against Neon.
Run with: python3 build_batch_may24.py
"""
import os, json, hashlib, time, sys
import psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')
BATCH_SIZE = 50  # commit every N folders
MAX_FILES_PER_FOLDER = 9999

print("Loading existing content hashes from Neon...", flush=True)
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != '' AND content_hash NOT LIKE 'pending_hash%'")
existing_hashes = {row[0] for row in cur.fetchall()}
cur.close()
conn.close()
print(f"  {len(existing_hashes)} existing hashes loaded", flush=True)

print("Loading gallery slug map...", flush=True)
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT slug, id FROM galleries WHERE is_active = true")
gallery_map = {row[0]: row[1] for row in cur.fetchall()}
cur.close()
conn.close()
print(f"  {len(gallery_map)} active galleries", flush=True)

cr_base = os.path.join(BASE, 'Costa-Rica-Gallery')
all_folders = sorted(os.listdir(cr_base))

items = []
total_files = total_new = total_dup = total_missing = total_skip_no_gallery = 0

start_time = time.time()

for folder_name in all_folders:
    folder_path = os.path.join(cr_base, folder_name)
    if not os.path.isdir(folder_path):
        continue

    image_files = sorted([
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])
    if not image_files:
        continue

    gallery_slug = folder_name.lower().replace(' ', '-').replace('--', '-')
    gallery_id = gallery_map.get(gallery_slug)
    if gallery_id is None:
        print(f"  SKIP (no gallery): {folder_name}", flush=True)
        total_skip_no_gallery += 1
        continue

    folder_new = 0
    for filename in image_files[:MAX_FILES_PER_FOLDER]:
        source_path = os.path.join(folder_path, filename)
        total_files += 1

        if not os.path.exists(source_path):
            total_missing += 1
            continue

        try:
            with open(source_path, 'rb') as f:
                content_hash = hashlib.sha256(f.read()).hexdigest()
        except Exception as e:
            print(f"  ERROR reading {filename}: {e}", flush=True)
            continue

        if content_hash in existing_hashes:
            total_dup += 1
        else:
            items.append({
                'id': f'ext_{folder_name.replace("/","_")}_{content_hash[:16]}',
                'type': 'photo',
                'source_path': source_path,
                'gallery_folder': f'Costa-Rica-Gallery/{folder_name}',
                'gallery_id': gallery_id,
                'gallery_slug': gallery_slug,
                'filename': filename,
                'content_hash': content_hash,
                'size': os.path.getsize(source_path),
                'approved': True,
                'priority': 50,
                'attempt_count': 0,
                'status': 'pending'
            })
            existing_hashes.add(content_hash)
            total_new += 1
            folder_new += 1

    elapsed = time.time() - start_time
    print(f"  [{elapsed:.0f}s] {folder_name}: {folder_new} new, {len(image_files)} total", flush=True)

    # Incremental save
    if len(items) >= BATCH_SIZE:
        with open(QUEUE_PATH, 'w') as f:
            json.dump(items, f)
        print(f"  -> Intermediate save: {len(items)} items", flush=True)

elapsed = time.time() - start_time
print(f"\n=== DONE ({elapsed:.0f}s) ===", flush=True)
print(f"Files scanned: {total_files}", flush=True)
print(f"New to import: {total_new}", flush=True)
print(f"Duplicates: {total_dup}", flush=True)
print(f"Missing files: {total_missing}", flush=True)
print(f"Skipped (no gallery): {total_skip_no_gallery}", flush=True)

if items:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    print(f"Saved: {len(items)} items -> {QUEUE_PATH}", flush=True)
else:
    print("No new items found.")