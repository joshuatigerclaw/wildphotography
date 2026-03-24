#!/usr/bin/env python3
"""
Fix missing medium_url derivatives for photos that have source_path on ADATA.
"""
import os
import subprocess
import psycopg2
import time
import sys

# R2 Config
AWS_ACCESS_KEY_ID = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_ACCESS_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"
R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
BUCKET = "wildphoto-storage"
R2_PUBLIC_BASE = "https://images.wildphotography.com"

DB_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

TEMP_DIR = "/tmp/wild_medium_fix"
os.makedirs(TEMP_DIR, exist_ok=True)

MEDIUM_SIZE = 1600
MEDIUM_QUALITY = 85

def run_cmd(cmd, env=None):
    env = env or os.environ.copy()
    env['AWS_ACCESS_KEY_ID'] = AWS_ACCESS_KEY_ID
    env['AWS_SECRET_ACCESS_KEY'] = AWS_SECRET_ACCESS_KEY
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, env=env)
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def upload_to_r2(local_path, r2_key):
    r2_url = f"s3://{BUCKET}/{r2_key}"
    cmd = f's5cmd --endpoint-url {R2_ENDPOINT} cp "{local_path}" "{r2_url}"'
    stdout, stderr, code = run_cmd(cmd)
    if code != 0:
        print(f"    Upload FAILED: {stderr[:200]}")
        return None
    return f"{R2_PUBLIC_BASE}/{r2_key}"

def generate_medium(input_path, output_path):
    cmd = f'convert "{input_path}" -resize {MEDIUM_SIZE}> -quality {MEDIUM_QUALITY} -sampling-factor 4:2:0 -strip "{output_path}"'
    stdout, stderr, code = run_cmd(cmd)
    if code != 0:
        print(f"    Convert FAILED: {stderr[:200]}")
        return False
    return os.path.exists(output_path)

def main():
    batch_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50

    print(f"=== WildPhotography Missing Medium URL Fix ===")
    print(f"Batch limit: {batch_limit}")
    print()

    conn = psycopg2.connect(DB_CONN)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, slug, source_path, medium_url
        FROM photos
        WHERE derivatives_complete = true
          AND (medium_url IS NULL OR medium_url = '')
          AND source_path IS NOT NULL
          AND source_path != ''
        ORDER BY id
        LIMIT %s
    """, (batch_limit,))
    records = cur.fetchall()

    print(f"Found {len(records)} photos with missing medium_url\n")

    if not records:
        print("No records to process.")
        cur.close()
        conn.close()
        return

    success = 0
    failed = 0
    skipped = 0
    errors = []

    for photo_id, slug, source_path, medium_url in records:
        print(f"[{photo_id}] {slug}")
        print(f"  Source: {source_path}")

        if not os.path.exists(source_path):
            print(f"  SKIP - source not found on disk\n")
            skipped += 1
            errors.append((photo_id, slug, "source file not found"))
            continue

        ext = source_path.rsplit('.', 1)[-1].lower()
        if ext not in ('jpg', 'jpeg', 'png', 'webp'):
            ext = 'jpg'

        local_orig = f"{TEMP_DIR}/{slug}_orig.{ext}"
        local_medium = f"{TEMP_DIR}/{slug}_medium.jpg"

        # Copy original to temp
        cp_cmd = f'cp "{source_path}" "{local_orig}"'
        cp_out, cp_err, cp_code = run_cmd(cp_cmd)
        if cp_code != 0:
            print(f"  SKIP - could not copy source\n")
            skipped += 1
            errors.append((photo_id, slug, "copy failed"))
            continue

        # Generate medium
        print(f"  medium: generating ({MEDIUM_SIZE}px)...")
        if not generate_medium(local_orig, local_medium):
            print(f"  SKIP - generation failed\n")
            skipped += 1
            try:
                os.remove(local_orig)
            except:
                pass
            errors.append((photo_id, slug, "generation failed"))
            continue

        # Upload to R2
        r2_key = f"derivatives/medium/{slug}.jpg"
        medium_url_result = upload_to_r2(local_medium, r2_key)

        # Cleanup
        for f in [local_orig, local_medium]:
            try:
                os.remove(f)
            except:
                pass

        if not medium_url_result:
            print(f"  SKIP - upload failed\n")
            failed += 1
            errors.append((photo_id, slug, "upload failed"))
            continue

        # Update DB
        try:
            cur.execute("""
                UPDATE photos
                SET medium_url = %s,
                    date_modified = NOW()
                WHERE id = %s
            """, (medium_url_result, photo_id))
            conn.commit()
            print(f"  OK -> {medium_url_result}")
            success += 1
        except Exception as e:
            conn.rollback()
            print(f"  DB update FAILED: {e}")
            failed += 1
            errors.append((photo_id, slug, f"db error: {e}"))

        print()
        time.sleep(0.2)

    cur.close()
    conn.close()

    print("=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"Records processed: {len(records)}")
    print(f"Success: {success}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    if errors:
        print("\nErrors:")
        for e in errors[:10]:
            print(f"  [{e[0]}] {e[1]}: {e[2]}")

if __name__ == "__main__":
    main()
