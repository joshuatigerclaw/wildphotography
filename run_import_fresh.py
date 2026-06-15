#!/usr/bin/env python3
"""
WildPhotography Import Worker - Run next batch from fresh_import_queue
1. Compute real SHA256 hashes for files with pending_hash
2. Check for duplicates in Neon
3. Process up to 5 folders, 100 photos
4. Upload originals + derivatives to R2
5. Insert into Neon
"""
import os, sys, json, tempfile, hashlib, uuid
from datetime import datetime, timezone
from PIL import Image

import boto3
import psycopg2

R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
R2_BUCKET = "wildphoto-storage"
R2_PUBLIC_DOMAIN = "pub-7d412c6efb5943b5bc587e695e22001e.r2.dev"
AWS_ACCESS_KEY_ID = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_ACCESS_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

DERIVATIVES = {
    "thumb":   (200, 200),
    "small":   (640, 480),
    "medium":  (1280, 960),
    "large":   (2560, 1920),
    "preview": (1920, 1440),
}

QUEUE_IN  = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_import_queue.json"
QUEUE_OUT = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_import_queue.json"
RESULT_PATH = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_import_results.json"

GALLERY_MAP = {
    "Costa-Rica-Gallery/Jaco-Beach": (48, "jaco-beach"),
    "Costa-Rica-Gallery/Limon-Puerto-Viejo-Cocles-Playa-Chiquita-y-Punta-Uva": (57, "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva"),
    "Costa-Rica-Gallery/Peninsula-Papagayo": (65, "peninsula-papagayo"),
    "Costa-Rica-Gallery/Sunrise-Sunset": (93, "sunrise-sunset"),
    "Costa-Rica-Gallery/Tambor-Nicoya-Peninsula-Costa-Rica": (95, "tambor-nicoya-peninsula-costa-rica"),
    "Costa-Rica-Gallery/Beaches": (110, "costa-rica-gallery-beaches"),
    "Costa-Rica-Gallery/Costa-Rica": (25, "costa-rica"),
    "Costa-Rica-Gallery/Best-of-Costa-Rica": (19, "best-of-costa-rica"),
    "Costa-Rica-Gallery/Wildlife": (6, "wildlife"),
    "Costa-Rica-Gallery/Arenal-Volcano": (16, "arenal-volcano"),
    "Costa-Rica-Gallery/Waterfalls-in-Costa-Rica": (100, "waterfalls-in-costa-rica"),
    "Costa-Rica-Gallery/Birds-Macaws-Lapas": (20, "birds-macaws-lapas"),
    "Costa-Rica-Gallery/Montezuma-Costa-Rica": (60, "montezuma-costa-rica"),
    "Costa-Rica-Gallery/Flowers-plants-trees": (35, "flowers-plants-trees"),
    "Costa-Rica-Gallery/Santa-Teresa-Malpais": (91, "santa-teresa-malpais"),
    "Costa-Rica-Gallery/Marine-Life-of-Costa-Rica": (58, "marine-life-of-costa-rica"),
    "Costa-Rica-Gallery/Puntarenas-Costa-Rica": (81, "puntarenas-costa-rica"),
    # 2025 Tambor New Years - maps to existing gallery_id=95
    "2025 Tambor New Years/Drone Selected/Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
    "2025 Tambor New Years/R6 Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
}

def get_s3():
    return boto3.client("s3", endpoint_url=R2_ENDPOINT,
        aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)

def compute_hash(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()

def upload_to_r2(s3, local_path, r2_key):
    ct = "image/jpeg"
    if local_path.lower().endswith(".png"): ct = "image/png"
    s3.upload_file(local_path, R2_BUCKET, r2_key, ExtraArgs={"ContentType": ct})

def generate_derivatives(source_path, hash_prefix, tmp_dir):
    results = {}
    with Image.open(source_path) as img:
        if img.mode in ("RGBA", "P", "LA"): img = img.convert("RGB")
        w, h = img.size
        orientation = "landscape" if w > h else "portrait" if h > w else "square"
        for name, (max_w, max_h) in DERIVATIVES.items():
            copy = img.copy()
            copy.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            out_path = os.path.join(tmp_dir, f"{hash_prefix}_{name}.jpg")
            copy.save(out_path, "JPEG", quality=85, optimize=True)
            results[name] = out_path
    return results, w, h, orientation

print("=== WildPhotography Import Batch ===")

# Load queue
with open(QUEUE_IN) as f:
    all_items = json.load(f)
print(f"Total queue items: {len(all_items)}")

# --- Step 1: compute real hashes for pending_hash items ---
print("\nComputing real hashes for files with placeholder hashes...")
hash_needs_compute = [i for i in all_items if str(i.get('content_hash','')).startswith('pending_hash')]
print(f"  Items needing hash: {len(hash_needs_compute)}")

computed = {}
for item in hash_needs_compute:
    sp = item.get('source_path','')
    if os.path.exists(sp):
        h = compute_hash(sp)
        item['content_hash'] = h
        computed[item['id']] = h
    else:
        item['content_hash'] = 'FILE_MISSING_' + item.get('id','')
print(f"  Real hashes computed: {len(computed)}")

# --- Step 2: load existing hashes from Neon ---
conn = psycopg2.connect(NEON_CONN)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != '' AND content_hash NOT LIKE 'pending_hash%'")
existing_hashes = set(r[0] for r in cur.fetchall())
cur.close()
conn.close()
print(f"Existing hashes in DB: {len(existing_hashes)}")

# --- Step 3: group by folder, pick 5 folders ---
folders_seen = {}
for item in all_items:
    gf = item.get("gallery_folder", "unknown")
    if gf not in folders_seen:
        folders_seen[gf] = []
    folders_seen[gf].append(item)

folder_list = list(folders_seen.keys())[:5]
print(f"\nFolders to process: {len(folder_list)}")
for f in folder_list:
    print(f"  - {f} ({len(folders_seen[f])} items)")

s3 = get_s3()
started_at = datetime.now(timezone.utc)
stats = {"total": 0, "imported": 0, "skipped_dup": 0, "skipped_no_gallery": 0, "skipped_missing": 0, "failed": 0}
results = []
upload_failures = 0

for folder_name in folder_list:
    if stats["imported"] >= 100:
        print("Max 100 photos reached.")
        break

    folder_items = folders_seen[folder_name]

    if folder_name not in GALLERY_MAP:
        print(f"\nSKIPPED (no gallery map): {folder_name}")
        stats["skipped_no_gallery"] += len(folder_items)
        for item in folder_items:
            results.append({"id": item.get("id"), "status": "skipped_no_gallery", "folder": folder_name})
        continue

    gallery_id, gallery_slug = GALLERY_MAP[folder_name]
    print(f"\nProcessing: {folder_name} -> gallery_id={gallery_id} slug={gallery_slug}")

    for i, item in enumerate(folder_items):
        if stats["imported"] >= 100:
            break

        source_path = item.get("source_path")
        content_hash = item.get("content_hash")
        filename = item.get("filename", os.path.basename(source_path or ""))

        if not source_path or not content_hash:
            results.append({"id": item.get("id"), "status": "skipped_missing_data"})
            stats["skipped_missing"] += 1
            continue

        if content_hash.startswith("FILE_MISSING"):
            results.append({"id": item.get("id"), "filename": filename, "status": "file_not_found", "source_path": source_path})
            stats["skipped_missing"] += 1
            continue

        if content_hash in existing_hashes:
            results.append({"id": item.get("id"), "filename": filename, "status": "skipped_dup", "gallery_slug": gallery_slug})
            stats["skipped_dup"] += 1
            continue

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                hash_prefix = content_hash[:16]
                orig_key = f"originals/{content_hash}.jpg"
                upload_to_r2(s3, source_path, orig_key)

                deriv_urls = {}
                deriv_paths, width, height, orientation = generate_derivatives(source_path, hash_prefix, tmp_dir)
                for name, deriv_path in deriv_paths.items():
                    d_key = f"derivatives/{hash_prefix}_{name}.jpg"
                    upload_to_r2(s3, deriv_path, d_key)
                    deriv_urls[name] = f"https://{R2_PUBLIC_DOMAIN}/{d_key}"

                slug = f"{gallery_slug}-{hash_prefix}"
                title = filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()

                conn2 = psycopg2.connect(NEON_CONN)
                conn2.autocommit = True
                cur2 = conn2.cursor()
                cur2.execute("""
                    INSERT INTO photos (
                        title, slug, gallery_id, content_hash,
                        original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url,
                        width, height, orientation, derivatives_complete,
                        ready_for_public_render, search_ready,
                        is_active, date_uploaded, uploaded_at, date_modified,
                        source_path, record_origin
                    ) VALUES (
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW(),NOW(),%s,%s
                    ) RETURNING id
                """, (
                    title, slug, gallery_id, content_hash,
                    orig_key,
                    deriv_urls.get("thumb",""), deriv_urls.get("small",""),
                    deriv_urls.get("medium",""), deriv_urls.get("large",""), deriv_urls.get("preview",""),
                    width, height, orientation, True,
                    True, True, True, source_path, "fresh_import_queue"
                ))
                photo_id = cur2.fetchone()[0]
                cur2.close()
                conn2.close()

                existing_hashes.add(content_hash)
                results.append({"id": item.get("id"), "filename": filename, "status": "ok", "photo_id": photo_id, "gallery_slug": gallery_slug})
                stats["imported"] += 1
                if stats["imported"] % 20 == 0:
                    print(f"  ... {stats['imported']} imported so far")

        except Exception as e:
            err_str = str(e)[:200]
            results.append({"id": item.get("id"), "filename": filename, "status": "failed", "reason": err_str})
            stats["failed"] += 1
            print(f"  FAILED {filename}: {err_str}")
            upload_failures += 1
            if upload_failures >= 3:
                print("FATAL: Too many upload failures, stopping batch.")
                break

    if upload_failures >= 3:
        break

# Update queue - remove processed items
processed_ids = set(r["id"] for r in results if r["status"] in ("ok", "skipped_dup", "skipped_no_gallery", "skipped_missing_data", "file_not_found"))
remaining = [item for item in all_items if item.get("id") not in processed_ids]
with open(QUEUE_OUT, 'w') as f:
    json.dump(remaining, f, indent=2)
print(f"\nQueue updated: {len(remaining)} items remain.")

# Save results
output = {
    "run_at": started_at.isoformat(),
    "folders_processed": folder_list,
    "total_items_in_queue": len(all_items),
    "hashes_computed": len(computed),
    "imported": stats["imported"],
    "skipped_dup": stats["skipped_dup"],
    "skipped_no_gallery": stats["skipped_no_gallery"],
    "skipped_missing": stats["skipped_missing"],
    "failed": stats["failed"],
    "results": results[:50],
}
with open(RESULT_PATH, 'w') as f:
    json.dump(output, f, indent=2)

print("\n" + "="*50)
print("BATCH IMPORT COMPLETE")
print("="*50)
for k, v in stats.items():
    print(f"  {k}: {v}")
print(f"\nResults: {RESULT_PATH}")