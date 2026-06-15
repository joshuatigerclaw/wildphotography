#!/usr/bin/env python3
"""
WildPhotography Import Worker - Best-of-Costa-Rica Fresh Import
Batch run: 2026-06-03
Discovered: ~99 new files in Best-of-Costa-Rica that were never scanned
"""
import os, sys, json, tempfile, hashlib, uuid
from datetime import datetime, timezone

import boto3
import psycopg2
from PIL import Image

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

# Best-of-Costa-Rica gallery: id=19, slug=best-of-costa-rica (is_active=true)
GALLERY_MAP = {
    "Costa-Rica-Gallery/Best-of-Costa-Rica": (19, "best-of-costa-rica"),
}

SOURCE_DIR = "/Volumes/ADATA SC740/Smugmug Backup/Galleries/Costa-Rica-Gallery/Best-of-Costa-Rica"

def get_s3():
    return boto3.client("s3", endpoint_url=R2_ENDPOINT,
        aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)

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
            results[name] = (out_path, copy.size)
    return results, w, h, orientation

def slugify(text):
    text = os.path.splitext(os.path.basename(text))[0]
    text = hashlib.md5(text.encode()).hexdigest()[:12]
    return text

def process_batch():
    started = datetime.now(timezone.utc)
    print(f"=== WildPhotography Import Batch: Best-of-Costa-Rica ===")
    print(f"Started: {started.isoformat()}")

    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor()

    s3 = get_s3()
    tmp_dir = tempfile.mkdtemp(prefix="wp_import_")

    # Get existing hashes for this gallery to skip duplicates
    gallery_folder = "Costa-Rica-Gallery/Best-of-Costa-Rica"
    gallery_id, gallery_slug = GALLERY_MAP[gallery_folder]
    cur.execute("SELECT content_hash FROM photos WHERE gallery_id = %s", (gallery_id,))
    existing_hashes = set(row[0] for row in cur.fetchall())
    print(f"Gallery {gallery_id} ({gallery_slug}): {len(existing_hashes)} existing hashes in DB")

    # Scan source files
    source_files = []
    for f in os.listdir(SOURCE_DIR):
        if f.startswith("._") or not (f.lower().endswith(".jpg") or f.lower().endswith(".jpeg") or f.lower().endswith(".png")):
            continue
        source_files.append(os.path.join(SOURCE_DIR, f))

    print(f"Source files found: {len(source_files)}")

    stats = {"total": 0, "imported": 0, "skipped_dup": 0, "failed": 0}
    results = []
    new_photo_ids = []
    failed_files = []

    for filepath in source_files:
        filename = os.path.basename(filepath)
        stats["total"] += 1

        try:
            content_hash = hashlib.md5(open(filepath, "rb").read()).hexdigest()

            if content_hash in existing_hashes:
                stats["skipped_dup"] += 1
                if stats["total"] % 50 == 0:
                    print(f"  [{stats['total']}] {filename}: duplicate, skipped")
                continue

            hash_prefix = content_hash[:16]

            # Generate derivatives
            derivs, w, h, orientation = generate_derivatives(filepath, hash_prefix, tmp_dir)

            # Upload original to R2
            ext = os.path.splitext(filename)[1].lower()
            if ext in (".jpg", ".jpeg"):
                ext = ".jpg"
            original_r2_key = f"originals/{gallery_slug}/{content_hash}{ext}"
            original_url = upload_to_r2(s3, filepath, original_r2_key)

            # Upload derivatives to R2
            deriv_urls = {}
            for name, (deriv_path, size) in derivs.items():
                deriv_key = f"derivatives/{gallery_slug}/{hash_prefix}_{name}.jpg"
                deriv_url = upload_to_r2(s3, deriv_path, deriv_key)
                deriv_urls[name] = deriv_url

            thumb_url = deriv_urls.get("thumb", "")
            small_url = deriv_urls.get("small", "")
            medium_url = deriv_urls.get("medium", "")
            large_url = deriv_urls.get("large", "")
            preview_url = deriv_urls.get("preview", "")

            # Insert into Neon
            slug = f"{gallery_slug}-{slugify(filename)}"
            now = datetime.now(timezone.utc)

            cur.execute("""
                INSERT INTO photos (gallery_id, gallery_slug, slug, content_hash, original_r2_key,
                    thumb_url, small_url, medium_url, large_url, preview_url,
                    status, search_ready, ready_for_public_render, derivatives_complete,
                    width, height, orientation, uploaded_at, is_active)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',true,true,true,%s,%s,%s,%s,true)
                RETURNING id
            """, (gallery_id, gallery_slug, slug, content_hash, original_r2_key,
                  thumb_url, small_url, medium_url, large_url, preview_url,
                  w, h, orientation, now))
            photo_id = cur.fetchone()[0]
            conn.commit()

            existing_hashes.add(content_hash)
            new_photo_ids.append(photo_id)
            stats["imported"] += 1

            if stats["imported"] % 10 == 0:
                print(f"  [{stats['imported']}] Imported photo_id={photo_id} {filename}")

        except Exception as e:
            err_str = str(e)[:200]
            stats["failed"] += 1
            failed_files.append({"filename": filename, "error": err_str})
            print(f"  FAILED {filename}: {err_str}")
            conn.rollback()  # Reset aborted transaction

    conn.close()

    # Cleanup
    import shutil
    shutil.rmtree(tmp_dir, ignore_errors=True)

    ended = datetime.now(timezone.utc)
    duration = (ended - started).total_seconds()

    print(f"\n=== BATCH COMPLETE ===")
    print(f"Duration: {duration:.1f}s")
    print(f"Total scanned: {stats['total']}")
    print(f"New imported: {stats['imported']}")
    print(f"Duplicates skipped: {stats['skipped_dup']}")
    print(f"Failed: {stats['failed']}")
    if new_photo_ids:
        print(f"New photo IDs: {new_photo_ids[0]} to {new_photo_ids[-1]}")

    # Save results
    result = {
        "run_at": started.isoformat(),
        "completed_at": ended.isoformat(),
        "duration_seconds": duration,
        "folder": gallery_folder,
        "gallery_id": gallery_id,
        "gallery_slug": gallery_slug,
        "source_files_found": len(source_files),
        "stats": stats,
        "new_photo_ids": new_photo_ids,
        "failed_files": failed_files[:20],
    }

    result_path = "/Users/joshuatenbrink/WildPhotography/inventory/import_batches/batch_20260603_bestofcr_discovered.json"
    with open(result_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nResults: {result_path}")

if __name__ == "__main__":
    process_batch()