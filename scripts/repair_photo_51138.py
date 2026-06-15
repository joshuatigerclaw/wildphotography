#!/usr/bin/env python3
"""
Single photo repair for photo 51138.
- Source exists in R2: originals/18/beaches--2016-01-13-12-58-06-1779344315741.jpg
- All derivatives missing (404 in R2)
- Regenerate all 5 derivatives and update DB
"""
import subprocess
import os
import json
import time

R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
BUCKET = "wildphoto-storage"
R2_PUBLIC = "https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev"

AWS_ACCESS_KEY_ID = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_ACCESS_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

PHOTO_ID = 51138
SLUG = "beaches--2016-01-13-12-58-06"
GALLERY_ID = 18
ORIGINAL_R2_KEY = "originals/18/beaches--2016-01-13-12-58-06-1779344315741.jpg"

SIZES = {
    "thumb": {"width": 400, "quality": 80},
    "small": {"width": 900, "quality": 85},
    "medium": {"width": 1600, "quality": 85},
    "large": {"width": 2400, "quality": 90},
    "preview": {"width": 1200, "quality": 80},
}

def run_cmd(cmd, env=None):
    env = env or os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = AWS_ACCESS_KEY_ID
    env["AWS_SECRET_ACCESS_KEY"] = AWS_SECRET_ACCESS_KEY
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, env=env)
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def download_original():
    local_path = f"/tmp/wild_repair_51138_orig.jpg"
    cmd = f's5cmd --endpoint-url {R2_ENDPOINT} cp "s3://{BUCKET}/{ORIGINAL_R2_KEY}" "{local_path}"'
    stdout, stderr, code = run_cmd(cmd)
    if code != 0 or not os.path.exists(local_path):
        print(f"  Download failed: {stderr[:300]}")
        return None
    print(f"  Downloaded original: {os.path.getsize(local_path)} bytes")
    return local_path

def generate_derivatives(original_path):
    results = {}
    for size_name, config in SIZES.items():
        output_path = f"/tmp/wild_repair_51138_{size_name}.jpg"
        # Use convert (ImageMagick) for generation
        cmd = f'convert "{original_path}" -resize {config["width"]}> -quality {config["quality"]} -sampling-factor 4:2:0 -strip "{output_path}"'
        stdout, stderr, code = run_cmd(cmd)
        if code != 0 or not os.path.exists(output_path):
            print(f"  [{size_name}] generation FAILED: {stderr[:200]}")
            results[size_name] = None
            continue
        results[size_name] = output_path
        print(f"  [{size_name}] generated: {os.path.getsize(output_path)} bytes -> {output_path}")
    return results

def upload_derivative(local_path, r2_key):
    cmd = f's5cmd --endpoint-url {R2_ENDPOINT} cp "{local_path}" "s3://{BUCKET}/{r2_key}"'
    stdout, stderr, code = run_cmd(cmd)
    if code != 0:
        print(f"  Upload FAILED: {stderr[:300]}")
        return None
    return f"{R2_PUBLIC}/{r2_key}"

def update_db(derivatives_urls):
    import psycopg2
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor()
    cur.execute("""
        UPDATE photos SET
            thumb_url = %s,
            small_url = %s,
            medium_url = %s,
            large_url = %s,
            preview_url = %s,
            r2_thumb_key = %s,
            r2_web_small_key = %s,
            r2_web_large_key = %s,
            r2_preview_key = %s,
            derivatives_complete = true,
            ready_for_public_render = true,
            search_ready = true,
            updated_at = NOW()
        WHERE id = %s
    """, [
        derivatives_urls.get("thumb", ""),
        derivatives_urls.get("small", ""),
        derivatives_urls.get("medium", ""),
        derivatives_urls.get("large", ""),
        derivatives_urls.get("preview", ""),
        derivatives_urls.get("thumb_key", ""),
        derivatives_urls.get("small_key", ""),
        derivatives_urls.get("large_key", ""),
        derivatives_urls.get("preview_key", ""),
        PHOTO_ID,
    ])
    conn.commit()
    cur.close()
    conn.close()
    print(f"  DB updated successfully for photo {PHOTO_ID}")

def main():
    report = {
        "photo_id": PHOTO_ID,
        "slug": SLUG,
        "gallery_id": GALLERY_ID,
        "original_r2_key": ORIGINAL_R2_KEY,
        "source_found": False,
        "derivatives_generated": {},
        "db_updated": False,
        "errors": [],
    }

    print(f"=== Repairing photo {PHOTO_ID}: {SLUG} ===\n")

    # Step 1: Download original
    print("[1] Downloading original from R2...")
    orig_path = download_original()
    if not orig_path:
        report["errors"].append("original_download_failed")
        with open("/Users/joshuatenbrink/.openclaw/workspace/wild_repair_single_photo_51138_report.json", "w") as f:
            json.dump(report, f, indent=2)
        print("FAILED: Could not download original")
        return

    report["source_found"] = True
    print(f"  Source found: {orig_path}\n")

    # Step 2: Generate derivatives
    print("[2] Generating derivatives...")
    deriv_paths = generate_derivatives(orig_path)
    print()

    # Step 3: Upload derivatives
    print("[3] Uploading derivatives to R2...")
    derivatives_uploaded = {}
    for size_name, local_path in deriv_paths.items():
        if not local_path:
            continue
        r2_key = f"derivatives/{PHOTO_ID}/{SLUG}_{size_name}.jpg"
        url = upload_derivative(local_path, r2_key)
        if url:
            derivatives_uploaded[size_name] = {
                "url": url,
                "r2_key": r2_key,
                "local_path": local_path,
                "size_bytes": os.path.getsize(local_path),
            }
            print(f"  [{size_name}] uploaded -> {url}")
        else:
            print(f"  [{size_name}] upload FAILED")

    report["derivatives_generated"] = derivatives_uploaded
    print()

    # Cleanup local files
    for f in [orig_path] + list(deriv_paths.values()):
        try:
            os.remove(f)
        except:
            pass

    # Step 4: Update DB
    if derivatives_uploaded:
        print("[4] Updating database...")
        # Build update dict
        db_urls = {}
        for size_name in SIZES:
            if size_name in derivatives_uploaded:
                db_urls[size_name] = derivatives_uploaded[size_name]["url"]
                db_urls[f"{size_name}_key"] = derivatives_uploaded[size_name]["r2_key"]
            else:
                db_urls[size_name] = ""
                db_urls[f"{size_name}_key"] = ""

        update_db(db_urls)
        report["db_updated"] = True
        print()

    # Final status
    print("[5] Verifying public URLs...")
    import urllib.request
    for size_name, info in derivatives_uploaded.items():
        url = info["url"]
        try:
            req = urllib.request.Request(url, method="HEAD")
            resp = urllib.request.urlopen(req, timeout=10)
            status = resp.status
        except Exception as e:
            status = f"ERROR: {e}"
        print(f"  [{size_name}] {url} -> {status}")

    print()
    print("=== REPORT ===")
    print(json.dumps(report, indent=2))

    # Save report
    report_path = "/Users/joshuatenbrink/.openclaw/workspace/wild_repair_single_photo_51138_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")

if __name__ == "__main__":
    main()