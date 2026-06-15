#!/usr/bin/env python3
"""
Build google_import_queue from google_incoming files.
Only includes truly new photos (hash not in Neon) that have gallery mapping.
"""
import os, json, hashlib

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

GALLERY_MAP = {
    "2025 Tambor New Years/Drone Selected/Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
    "2025 Tambor New Years/R6 Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
    "Galleries/Costa-Rica-Gallery/Bajos-del-Toro-Costa-Rica": (17, "bajos-del-toro-costa-rica"),
}

def compute_hash(path):
    h = hashlib.sha256()
    try:
        with open(path, 'rb') as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                h.update(chunk)
    except Exception:
        return None
    return h.hexdigest()

# Load existing hashes from Neon
import psycopg2
conn = psycopg2.connect(NEON_CONN)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != '' AND content_hash NOT LIKE 'pending_hash%'")
existing_hashes = set(r[0] for r in cur.fetchall())
cur.close()
conn.close()
print(f"Neon existing hashes: {len(existing_hashes)}")

# Load all google incoming sources
google_files = {
    'batch': '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_incoming_batch.json',
    'manifest': '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_incoming_manifest.json',
    'new_files': '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_incoming_new_files.json',
}

all_candidates = []
for src_name, src_path in google_files.items():
    with open(src_path, 'r') as f:
        data = json.load(f)
    for item in data:
        rf = item.get('relative_folder', '')
        if rf not in GALLERY_MAP:
            continue
        all_candidates.append(item)
    print(f"Loaded {src_name}: {len(data)} items")

print(f"Total candidates with gallery mapping: {len(all_candidates)}")

# Compute hashes for items missing them, filter out duplicates
queue_items = []
seen_hashes = set()
hash_computed = 0
hash_missing_file = 0

for item in all_candidates:
    sha = item.get('sha256')
    rf = item.get('relative_folder', '')
    
    # Compute hash if missing or None
    if not sha or sha is None:
        path = item.get('absolute_path', '')
        sha = compute_hash(path)
        if sha is None:
            hash_missing_file += 1
            continue
        hash_computed += 1
    
    # Skip if duplicate in Neon
    if sha in existing_hashes or sha in seen_hashes:
        continue
    
    seen_hashes.add(sha)
    gid, gslug = GALLERY_MAP[rf]
    queue_items.append({
        "id": f"gd_{sha[:12]}",
        "type": "photo",
        "source_path": item.get('absolute_path', ''),
        "gallery_folder": rf,
        "gallery_slug": gslug,
        "filename": item.get('filename', ''),
        "content_hash": sha,
        "size": item.get('size', 0),
        "approved": True,
        "priority": 50,
        "attempt_count": 0,
        "status": "pending",
    })

print(f"Hashes computed for missing: {hash_computed}")
print(f"Files missing (skipped): {hash_missing_file}")
print(f"Truly new queue items: {len(queue_items)}")

# Group by folder for batch limits
folder_items = {}
for item in queue_items:
    gf = item['gallery_folder']
    if gf not in folder_items:
        folder_items[gf] = []
    folder_items[gf].append(item)

# Limit to 5 folders, 100 photos
folder_list = list(folder_items.keys())[:5]
final_items = []
total_photos = 0

for folder in folder_list:
    items_in_folder = folder_items[folder][:20]  # max 20 per folder
    for item in items_in_folder:
        if total_photos >= 100:
            break
        final_items.append(item)
        total_photos += 1
    if total_photos >= 100:
        break

print(f"\nFinal batch: {len(final_items)} photos from {len(set(i['gallery_folder'] for i in final_items))} folders")
for item in final_items[:3]:
    print(f"  {item['gallery_folder']} | {item['filename']} | hash={item['content_hash'][:16]}")

# Save
queue_path = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_import_queue.json"
with open(queue_path, 'w') as f:
    json.dump(final_items, f, indent=2)
print(f"\nSaved to: {queue_path}")