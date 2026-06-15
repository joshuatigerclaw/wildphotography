#!/usr/bin/env python3
"""
WildPhotography Custom Import Runner for Google Drive batches.
Uses pre-built fresh_import_queue.json with the correct GALLERY_MAP including Google Drive paths.
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
RESULT_PATH = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_import_results.json"

GALLERY_MAP = {
    # Google Drive paths (used for 2025 Tambor New Years imports)
    "2025 Tambor New Years/Drone Selected/Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
    "2025 Tambor New Years/R6 Selected": (95, "tambor-nicoya-peninsula-costa-rica"),
    "2025 Tambor New Years/Montezuma": (60, "montezuma-costa-rica"),
    "Galleries/Costa-Rica-Gallery/Bajos-del-Toro-Costa-Rica": (17, "bajos-del-toro-costa-rica"),
    "Galleries/Costa-Rica-Gallery/Birds": (20, "birds-macaws-lapas"),
    # Smugmug paths
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
    "Costa-Rica-Gallery/Santa-Tesa-Malpais": (91, "santa-teresa-malpais"),
    "Costa-Rica-Gallery/Marine-Life-of-Costa-Rica": (58, "marine-life-of-costa-rica"),
    "Costa-Rica-Gallery/Puntarenas-Costa-Rica": (81, "puntarenas-costa-rica"),
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
    return f"https://{R2_PUBLIC_DOMAIN}/{r2_key}"

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

print("=== WildPhotography Custom Google Import Runner ===")

# Load queue
with open(QUEUE_IN) as f:
    all_items = json.load(f)
# Support dict format or list format
if isinstance(all_items, dict):
    all_items = all_items.get("items", [])
print(f"Total queue items: {len(all_items)}")

# Step 1: load existing hashes from Neon
conn = psycopg2.connect(NEON_CONN)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL AND content_hash != '' AND content_hash NOT LIKE 'pending_hash%'")
existing_hashes = set(r[0] for r in cur.fetchall())
cur.close()
conn.close()
print(f"Existing hashes in DB: {len(existing_hashes)}")

# Step 2: group by folder
folders_seen = {}
for item in all_items:
    gf = item.get("gallery_folder", "unknown")
    if gf not in folders_seen:
        folders_seen[gf] = []
    folders_seen[gf].append(item)

print(f"\nFolders to process: {len(folders_seen)}")
for f, items in folders_seen.items():
    print(f"  - {f} ({len(items)} items)")

s3 = get_s3()
stats = {"total": len(all_items), "imported": 0, "skipped_dup": 0, "skipped_no_gallery": 0, "skipped_missing": 0, "failed": 0}
results = []

for folder_name, folder_items in folders_seen.items():
    if stats["imported"] >= 100:
        print("Max 100 photos reached.")
        break

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
            print("Max 100 photos reached.")
            break

        source_path = item.get("source_path")
        content_hash = item.get("content_hash")
        filename = item.get("filename", os.path.basename(source_path or ""))

        if not source_path or not content_hash:
            results.append({"id": item.get("id"), "status": "skipped_missing_data"})
            stats["skipped_missing"] += 1
            continue

        if content_hash in existing_hashes:
            results.append({"id": item.get("id"), "filename": filename, "status": "skipped_dup", "gallery_slug": gallery_slug})
            stats["skipped_dup"] += 1
            continue

        if not os.path.exists(source_path):
            results.append({"id": item.get("id"), "filename": filename, "status": "file_not_found", "source_path": source_path})
            stats["skipped_missing"] += 1
            continue

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                hash_prefix = content_hash[:16]
                orig_key = f"originals/{content_hash}.jpg"
                print(f"  [{i+1}/{len(folder_items)}] Uploading {filename} -> {hash_prefix}")
                upload_to_r2(s3, source_path, orig_key)

                thumb_key = f"derivatives/{hash_prefix}_thumb.jpg"
                small_key = f"derivatives/{hash_prefix}_small.jpg"
                medium_key = f"derivatives/{hash_prefix}_medium.jpg"
                large_key = f"derivatives/{hash_prefix}_large.jpg"
                preview_key = f"derivatives/{hash_prefix}_preview.jpg"
                deriv_keys = {"thumb": thumb_key, "small": small_key, "medium": medium_key, "large": large_key, "preview": preview_key}
                deriv_paths, width, height, orientation = generate_derivatives(source_path, hash_prefix, tmp_dir)
                for name, deriv_path in deriv_paths.items():
                    d_key = deriv_keys[name]
                    upload_to_r2(s3, deriv_path, d_key)
                    deriv_urls[name] = f"https://{R2_PUBLIC_DOMAIN}/{d_key}"

                slug = f"{gallery_slug}-{hash_prefix}"
                title = os.path.splitext(filename)[0]
                description = f"Photo from {gallery_slug.replace('-', ' ').title()} in Costa Rica"
                keywords = f"Costa Rica, {gallery_slug.replace('-', ', ')}"
                location_name = gallery_slug.replace('-', ' ').title()
                region = "Costa Rica"
                country = "Costa Rica"
                orientation_lower = orientation.lower()

                conn = psycopg2.connect(NEON_CONN)
                cur = conn.cursor()
                cur.execute(""""
                    INSERT INTO photos (
                        title, slug, gallery_id, content_hash,
                        original_r2_key, thumb_r2_key, small_r2_key, medium_r2_key,
                        large_r2_key, preview_r2_key,
                        original_url, thumb_url, small_url, medium_url, large_url, preview_url,
                        width, height, orientation, description, keywords,
                        location_name, region, country,
                        search_ready, status, metadata_complete, ready_for_public_render,
                        created_at, updated_at
                    ) VALUES (
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    )
                """, (
                    title, slug, gallery_id, content_hash,
                    orig_key,
                    thumb_key, small_key, medium_key, large_key, preview_key,
                    f"https://{R2_PUBLIC_DOMAIN}/{orig_key}",
                    deriv_urls.get("thumb", ""),
                    deriv_urls.get("small", ""),
                    deriv_urls.get("medium", ""),
                    deriv_urls.get("large", ""),
                    deriv_urls.get("preview", ""),
                    width, height, orientation_lower,
                    description, keywords,
                    location_name, region, country,
                    True, 'ready', True, True,
                    datetime.now(timezone.utc), datetime.now(timezone.utc)
                ))
                conn.commit()
                cur.close()
                conn.close()

                results.append({
                    "id": item.get("id"),
                    "photo_id": slug,
                    "filename": filename,
                    "content_hash": content_hash,
                    "gallery_id": gallery_id,
                    "gallery_slug": gallery_slug,
                    "status": "imported"
                })
                stats["imported"] += 1
                print(f"    -> IMPORTED ({stats['imported']} total)")

        except Exception as e:
            results.append({
                "id": item.get("id"),
                "filename": filename,
                "status": "failed",
                "error": str(e)
            })
            stats["failed"] += 1
            print(f"    -> FAILED: {e}")

# Save results and update queue
with open(RESULT_PATH, 'w') as f:
    json.dump(results, f, indent=2)
print(f"\nResults saved to {RESULT_PATH}")

with open(QUEUE_IN, 'w') as f:
    json.dump([], f)

print("\n" + "="*50)
print("BATCH IMPORT COMPLETE")
print("="*50)
print(f"  total: {stats['total']}")
print(f"  imported: {stats['imported']}")
print(f"  skipped_dup: {stats['skipped_dup']}")
print(f"  skipped_no_gallery: {stats['skipped_no_gallery']}")
print(f"  skipped_missing: {stats['skipped_missing']}")
print(f"  failed: {stats['failed']}")
