import json
from collections import Counter

# Check results
with open('/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_batch_next_5_results.json') as f:
    d = json.load(f)
results = d.get('results', [])
print(f'Results count: {len(results)}')
statuses = Counter(r.get('status') for r in results)
print(f'Statuses: {dict(statuses)}')
galleries = Counter(r.get('gallery_folder', r.get('gallery_slug')) for r in results)
print(f'Galleries in results: {dict(galleries)}')

# Check queue
with open('/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_batch_next_5.json') as f:
    q = json.load(f)
print(f'\nQueue now has: {len(q)} items')
if q:
    print(f'First item: {q[0].get("gallery_folder")} | {q[0].get("source_path","NO_PATH")[:60]}')

# The queue was updated to remove processed items - the import script removes
# items that were "ok" or "skipped_dup" from the queue
# But we got all skipped_no_gallery for 100 items... which means only the first
# folder (Beaches, 100 items) was processed before the queue was updated
# Wait - the queue should have been updated with processed_ids = set of ok+skipped_dup
# Since ALL results were skipped_no_gallery, none would be removed
# So queue would still have 500. But it says 100 remain.

# Actually let me re-read the script logic more carefully
# The import script loops through folder_list = list(folders_seen.keys())[:5]
# That's 5 folders
# For each folder, it processes items with a 100 photo max per batch total
# if stats["imported"] >= 100: break

# So total 100 max across all folders
# First folder = Beaches (100 items) = all skipped_no_gallery (100 items = 1 folder = done)
# Second folder = Jaco (100 items) - never reached because imported count already hit limit from first folder? NO
# Because skipped_no_gallery doesn't increment imported counter

# Let me trace through more carefully:
# stats = {"total": 0, "imported": 0, "skipped_dup": 0, "failed": 0}
# For Beaches (100 items):
#   - each item: not in GALLERY_MAP so skipped with stats["skipped_dup"] += 1
#   - at end: skipped_no_gallery for all 100
# For Jaco (100 items):
#   - gallery_id=48, slug=jaco-beach - MAPPED
#   - each item: content_hash NOT in existing_hashes (based on earlier import) - NOT skipped_dup
#   - so it should try to import? But results show only skipped_no_gallery
# Wait - I think the issue is that the script only adds to results when it has a status
# Let me look at results generation

# The script does: results.append({"id": item.get("id"), "status": "skipped_no_gallery"...})
# For Jaco, it should have different results. Let me check if there are any results for other folders.

# Actually the problem might be that only 100 results were saved due to:
# output = { "results": results[:100], ...}
# And only the first folder's 100 skipped_no_gallery entries were generated before the queue update

# Actually wait - re-reading the results more carefully:
# All 100 entries are from Beaches (skipped_no_gallery)
# Jaco, Limon, Sunrise, Tambor items are NOT in results
# This means the script processed only the first folder before the queue update

# I think what happened is:
# 1. Script loads queue with 500 items (5 folders)
# 2. Groups into folders_seen = {Beaches:100, Jaco:100, Limon:100, Sunrise:100, Tambor:100}
# 3. folder_list = first 5 folders = all 5
# 4. Loop first folder (Beaches): all 100 get skipped_no_gallery, stats["skipped_dup"]=100
# 5. Loop second folder (Jaco): gets mapped, processes items... but wait
# 6. Actually - the content_hash values - check if they exist in DB

# The key issue: content_hash in batch_new_folders_queue starts with the actual hash
# but content_hash in batch_next_import had "pending" - that's the difference
# These have valid hashes, so they should NOT be skipped as duplicates based on hash check

# But the script checks: if content_hash in existing_hashes: skip
# If hashes are already in DB, they would be skipped
# Let me verify: how many hashes are in the existing set?

print("\n--- Checking DB hash count ---")
import psycopg2
conn = psycopg2.connect("postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require")
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM photos WHERE content_hash IS NOT NULL AND content_hash != ''")
count = cur.fetchone()[0]
print(f"Photos with content_hash: {count}")

# Check how many of the batch hashes already exist in DB
batch_hashes = set()
with open('/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/batch_new_folders_queue.json') as f:
    d = json.load(f)
items = d if isinstance(d, list) else d.get('items', d.get('queue', []))
for item in items:
    h = item.get('content_hash', '')
    if h and not h.startswith('pending'):
        batch_hashes.add(h)

print(f"Unique hashes in batch: {len(batch_hashes)}")

cur.execute("SELECT content_hash FROM photos WHERE content_hash = ANY(%s)", (list(batch_hashes),))
existing = set(r[0] for r in cur.fetchall())
print(f"Hashes that already exist in DB: {len(existing)}")
print(f"New hashes (would import): {len(batch_hashes) - len(existing)}")

cur.close()
conn.close()