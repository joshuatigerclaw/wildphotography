#!/usr/bin/env python3
"""
Quick scan of ALL Costa-Rica-Gallery folders to find any with new content.
"""
import os
import hashlib
import psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

# Load existing hashes
print("Loading existing content hashes from Neon...")
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
existing_hashes = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f"  Existing hashes in DB: {len(existing_hashes)}\n")

cr_gallery = os.path.join(BASE, 'Costa-Rica-Gallery')
folders = sorted(os.listdir(cr_gallery))

total_new = 0
total_dup = 0

for folder in folders:
    folder_path = os.path.join(cr_gallery, folder)
    if not os.path.isdir(folder_path):
        continue
    
    image_files = [
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ]
    
    if not image_files:
        continue
    
    folder_new = 0
    folder_dup = 0
    
    for filename in image_files[:30]:  # Sample first 30 only for speed
        source_path = os.path.join(folder_path, filename)
        if not os.path.exists(source_path):
            continue
        with open(source_path, 'rb') as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()
        if content_hash in existing_hashes:
            folder_dup += 1
        else:
            folder_new += 1
    
    total_new += folder_new
    total_dup += folder_dup
    
    status = "HAS_NEW" if folder_new > 0 else "all_dup"
    print(f"{status}: {folder} ({len(image_files)} files, sampled 30: {folder_new} new, {folder_dup} dup)")

print(f"\nSummary: {total_new} new in samples, {total_dup} dup in samples")