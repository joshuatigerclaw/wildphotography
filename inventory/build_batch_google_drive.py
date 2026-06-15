#!/usr/bin/env python3
"""
Build import batch from Google Drive incoming photos - May 8 evening.
Scans 386 Google Drive manifest items against Neon DB.
"""
import json, hashlib, os, psycopg2

MANIFEST = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_incoming_manifest.json'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json'
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

with open(MANIFEST) as f:
    manifest = json.load(f)
print(f"Manifest: {len(manifest)} items")

# Load existing hashes
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
existing = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f"Existing hashes: {len(existing)}")

gallery_map = {
    'Costa-Rica-Gallery/Crocodiles':           (30, 'crocodiles'),
    'Costa-Rica-Gallery/Boats-in-Costa-Rica':  (21, 'boats-in-costa-rica'),
    'Costa-Rica-Gallery/Butterflies':          (22, 'butterflies'),
    'Costa-Rica-Gallery/Cartago':              (23, 'cartago'),
    'Costa-Rica-Gallery/Coyol-de-Alajuela':    (29, 'coyol-de-alajuela'),
    'Costa-Rica-Gallery/Birds':               (5,  'birds'),
    'Costa-Rica-Gallery/Bajos-del-Toro-Costa-Rica': (17, 'bajos-del-toro-costa-rica'),
    'Tambor':                                  (95, 'tambor-nicoya-peninsula-costa-rica'),
}

items = []
new_count = 0
dup_count = 0
missing_count = 0
unmapped_count = 0

for item in manifest:
    path = item.get('absolute_path', '')
    
    if not os.path.exists(path):
        missing_count += 1
        continue
    
    try:
        with open(path, 'rb') as f:
            h = hashlib.sha256(f.read()).hexdigest()
    except Exception as e:
        print(f"  ERROR reading {path}: {e}")
        continue
    
    if h in existing:
        dup_count += 1
        continue
    
    # Determine gallery mapping
    rel_folder = item.get('relative_folder', '')
    gallery_id, gallery_slug = None, None
    for key, (gid, slug) in gallery_map.items():
        if key in rel_folder:
            gallery_id, gallery_slug = gid, slug
            break
    
    if not gallery_id:
        unmapped_count += 1
        continue
    
    items.append({
        'id': f'gd_{h[:16]}',
        'type': 'photo',
        'source_path': path,
        'gallery_folder': rel_folder,
        'gallery_id': gallery_id,
        'gallery_slug': gallery_slug,
        'filename': os.path.basename(path),
        'content_hash': h,
        'size': os.path.getsize(path),
        'approved': True,
        'priority': 50,
        'attempt_count': 0,
        'status': 'pending'
    })
    new_count += 1

print(f"Result: {new_count} new, {dup_count} dup, {missing_count} missing, {unmapped_count} unmapped")

# Deduplicate by content_hash (keep first)
seen = {}
deduped = []
for item in items:
    h = item['content_hash']
    if h not in seen:
        seen[h] = True
        deduped.append(item)

print(f"After dedup: {len(deduped)} items")

if deduped:
    with open(QUEUE_PATH, 'w') as f:
        json.dump(deduped, f, indent=2)
    print(f"Saved to {QUEUE_PATH}")
else:
    print("No new items found")
