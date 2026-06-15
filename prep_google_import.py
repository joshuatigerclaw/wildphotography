import json, os, psycopg2

NEON = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
conn = psycopg2.connect(NEON)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != ''")
existing_hashes = set(r[0] for r in cur.fetchall())
cur.close()
conn.close()
print(f"DB hashes: {len(existing_hashes)}")

GALLERY_MAP = {
    "2025 Tambor New Years/Drone Selected/Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
    "2025 Tambor New Years/R6 Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
    "Galleries/Costa-Rica-Gallery/Bajos-del-Toro-Costa-Rica": (17, "bajos-del-toro-costa-rica"),
}

google_files = [
    '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_incoming_batch.json',
    '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_incoming_manifest.json',
    '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/google_incoming_new_files.json',
]

seen_hashes = set()
queue_items = []

for gpath in google_files:
    with open(gpath, 'r') as f:
        data = json.load(f)
    for item in data:
        sha = item['sha256']
        rf = item['relative_folder']
        if sha not in existing_hashes and sha not in seen_hashes and rf in GALLERY_MAP:
            seen_hashes.add(sha)
            gid, gslug = GALLERY_MAP[rf]
            queue_items.append({
                "id": f"gd_{sha[:12]}",
                "type": "photo",
                "source_path": item['absolute_path'],
                "gallery_folder": rf,
                "gallery_slug": gslug,
                "filename": item['filename'],
                "content_hash": sha,
                "size": item.get('size', 0),
                "approved": True,
                "priority": 50,
                "attempt_count": 0,
                "status": "pending",
            })

print(f"Total queue items: {len(queue_items)}")
for item in queue_items[:5]:
    print(f"  {item['gallery_folder']} | {item['filename']} | hash={item['content_hash'][:16]}")

# Save
queue_path = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_import_queue.json"
with open(queue_path, 'w') as f:
    json.dump(queue_items, f, indent=2)
print(f"\nSaved {len(queue_items)} items to fresh_import_queue.json")