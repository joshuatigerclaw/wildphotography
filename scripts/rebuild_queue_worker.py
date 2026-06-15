#!/usr/bin/env python3
"""
Direct derivative rebuild worker - reads from Neon derivative_rebuild_queue table,
processes each photo, updates DB, and marks queue items complete.
"""

import sys
import os
from datetime import datetime
from PIL import Image
from io import BytesIO
import psycopg2
import boto3
from botocore.config import Config

# === CONFIG ===
R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
R2_BUCKET = "wildphoto-storage"
R2_ACCESS_KEY = "b821d56d29d9a2c716f783fc481e2f75"
R2_SECRET_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"
R2_PUBLIC_BASE = "https://images.wildphotography.com"

DB_CONFIG = {
    "host": "ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech",
    "database": "wildphotography",
    "user": "neondb_owner",
    "password": "npg_BvF2JsQ8drba",
    "sslmode": "require",
}

SIZES = {
    "thumb":  {"width": 400,  "quality": 80},
    "small":  {"width": 900,  "quality": 85},
    "medium": {"width": 1600, "quality": 85},
    "large":  {"width": 2400, "quality": 90},
    "web":    {"width": 1200, "quality": 85},
}

# === LOGGING ===
def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)

# === R2 ===
def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )

def download_from_r2(r2_key):
    try:
        r2 = get_r2_client()
        obj = r2.get_object(Bucket=R2_BUCKET, Key=r2_key)
        return obj["Body"].read()
    except Exception as e:
        log(f"R2 download error {r2_key}: {e}")
        return None

def upload_to_r2(r2_key, data, content_type="image/jpeg"):
    try:
        r2 = get_r2_client()
        r2.put_object(Bucket=R2_BUCKET, Key=r2_key, Body=data, ContentType=content_type)
        return True
    except Exception as e:
        log(f"R2 upload error {r2_key}: {e}")
        return False

# === Image processing ===
def generate_derivative(image_bytes, width, quality):
    try:
        img = Image.open(BytesIO(image_bytes))
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            if img.mode in ("RGBA", "LA"):
                background.paste(img, mask=img.split()[-1])
                img = background
            else:
                img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        w, h = img.size
        if w > width:
            new_h = int(h * (width / w))
            img = img.resize((width, new_h), Image.LANCZOS)

        out = BytesIO()
        img.save(out, format="JPEG", quality=quality, optimize=True)
        return out.getvalue()
    except Exception as e:
        log(f"Image processing error: {e}")
        return None

# === DB helpers ===
def get_db_conn():
    return psycopg2.connect(**DB_CONFIG)

def get_photo_metadata(photo_id):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, slug, original_r2_key FROM photos WHERE id = %s",
            (photo_id,)
        )
        row = cur.fetchone()
        if row:
            return {"id": row[0], "slug": row[1], "original_r2_key": row[2]}
        return None
    finally:
        conn.close()

def update_photo_derivatives(photo_id, deriv_urls, r2_keys):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE photos SET
                thumb_url  = %(thumb_url)s,
                small_url  = %(small_url)s,
                medium_url = %(medium_url)s,
                large_url  = %(large_url)s,
                preview_url = %(preview_url)s,
                r2_thumb_key = %(r2_thumb_key)s,
                r2_web_small_key = %(r2_web_small_key)s,
                r2_web_large_key = %(r2_web_large_key)s,
                derivatives_complete = true,
                ready_for_public_render = true,
                search_ready = true,
                updated_at = NOW()
            WHERE id = %(photo_id)s
        """, {
            "thumb_url": deriv_urls.get("thumb"),
            "small_url": deriv_urls.get("small"),
            "medium_url": deriv_urls.get("medium"),
            "large_url": deriv_urls.get("large"),
            "preview_url": deriv_urls.get("web"),
            "r2_thumb_key": r2_keys.get("thumb"),
            "r2_web_small_key": r2_keys.get("small"),
            "r2_web_large_key": r2_keys.get("large"),
            "photo_id": photo_id,
        })
        conn.commit()
        return True
    except Exception as e:
        log(f"DB update error photo_id={photo_id}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def mark_queue_complete(queue_id):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE derivative_rebuild_queue SET status = 'completed', last_error = NULL WHERE id = %s",
            (queue_id,)
        )
        conn.commit()
    finally:
        conn.close()

def mark_queue_failed(queue_id, error_msg):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE derivative_rebuild_queue 
            SET status = 'repair_failed', last_error = %s, attempts = attempts + 1
            WHERE id = %s
        """, (error_msg, queue_id))
        conn.commit()
    finally:
        conn.close()

# === Process one photo ===
def process_one(queue_id, photo_id, slug, original_r2_key):
    log(f"--- Processing queue_id={queue_id} photo_id={photo_id} slug={slug}")
    
    original_bytes = download_from_r2(original_r2_key)
    if not original_bytes:
        mark_queue_failed(queue_id, "original_not_in_r2")
        return False
    
    deriv_urls = {}
    r2_keys = {}
    failures = 0
    
    for size_name, cfg in SIZES.items():
        r2_key = f"derivatives/{slug}/{slug}_{size_name}.jpg"
        deriv_bytes = generate_derivative(original_bytes, cfg["width"], cfg["quality"])
        if not deriv_bytes:
            log(f"  [{size_name}] FAILED to generate")
            failures += 1
            continue
        
        ok = upload_to_r2(r2_key, deriv_bytes)
        if not ok:
            log(f"  [{size_name}] FAILED to upload")
            failures += 1
            continue
        
        public_url = f"{R2_PUBLIC_BASE}/derivatives/{slug}/{slug}_{size_name}.jpg"
        deriv_urls[size_name] = public_url
        r2_keys[size_name] = r2_key
        log(f"  [{size_name}] OK -> {len(deriv_bytes):,} bytes")
    
    if not deriv_urls:
        mark_queue_failed(queue_id, "no_derivatives_generated")
        return False
    
    ok = update_photo_derivatives(photo_id, deriv_urls, r2_keys)
    if not ok:
        mark_queue_failed(queue_id, "db_update_failed")
        return False
    
    mark_queue_complete(queue_id)
    return True

# === Main ===
def main():
    log("=== Derivative Rebuild Worker started ===")
    
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, photo_id, status, last_error, attempts
            FROM derivative_rebuild_queue
            WHERE status IN ('repair_failed', 'pending')
            ORDER BY attempts ASC, id ASC
            LIMIT 30
        """)
        rows = cur.fetchall()
    finally:
        conn.close()
    
    log(f"Found {len(rows)} items in queue")
    
    if not rows:
        log("Nothing to process.")
        return
    
    results = {"ok": 0, "failed": 0}
    
    for row in rows:
        queue_id, photo_id, status, last_error, attempts = row
        log(f"\n>>> queue_id={queue_id} photo_id={photo_id} status={status} attempts={attempts}")
        
        meta = get_photo_metadata(photo_id)
        if not meta:
            log(f"Photo {photo_id} not found in DB")
            mark_queue_failed(queue_id, "photo_not_found")
            results["failed"] += 1
            continue
        
        slug = meta["slug"]
        original_r2_key = meta["original_r2_key"]
        
        if not original_r2_key:
            log(f"No original_r2_key for photo_id={photo_id}")
            mark_queue_failed(queue_id, "no_original_r2_key")
            results["failed"] += 1
            continue
        
        success = process_one(queue_id, photo_id, slug, original_r2_key)
        if success:
            results["ok"] += 1
        else:
            results["failed"] += 1
    
    log(f"\n=== Done ===")
    log(f"OK: {results['ok']}, Failed: {results['failed']}")

if __name__ == "__main__":
    main()
