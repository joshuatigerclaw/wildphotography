#!/usr/bin/env python3
"""
WildPhotography Import Worker - Batch 20260429-2
"""

import json
import os
import subprocess
import re
from datetime import datetime

R2_ACCOUNT_ID = "3ec62f93675c404fe4a9a4949e38e5e5"
R2_BUCKET = "wildphoto-storage"

DERIVATIVES = [
    (150, "thumb", 150),
    (300, "small", 300),
    (800, "medium", 800),
    (1600, "large", 1600),
    (2400, "preview", 2400),
]

def run_cmd(cmd, capture=True):
    result = subprocess.run(cmd, shell=True, capture_output=capture, text=True, timeout=120)
    if result.returncode != 0:
        print("  Cmd error: " + str(result.stderr[:200]))
        return None
    if capture:
        return result.stdout.strip() if result.stdout else ""
    return True

def upload_to_r2(file_path, object_key):
    endpoint = "https://" + R2_ACCOUNT_ID + ".r2.cloudflarestorage.com"
    cmd = 'aws s3 cp "' + file_path + '" "s3://' + R2_BUCKET + '/' + object_key + '" --endpoint-url "' + endpoint + '" --acl public-read'
    result = run_cmd(cmd)
    return result is not None

def generate_slug(filename):
    name = os.path.splitext(filename)[0]
    slug = re.sub(r'[\s.]+', '-', name)
    slug = re.sub(r'[^a-zA-Z0-9\-]', '', slug)
    slug = slug.lower()
    return slug

def check_duplicate_hash(content_hash):
    sql = "SELECT id FROM photos WHERE content_hash = '" + content_hash + "' LIMIT 1;"
    cmd = "PGPASSWORD=npg_BvF2JsQ8drba psql -h ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech -U neondb_owner -d wildphotography -t -c \"" + sql + "\" 2>&1"
    result = run_cmd(cmd)
    return result is not None and result.strip() != ""

def insert_photo_record(slug, title, original_r2_key, gallery_id, thumb_url, small_url, medium_url, large_url, preview_url, width, height, content_hash, size_bytes):
    title_escaped = title.replace("'", "''")
    sql = "INSERT INTO photos (slug, title, gallery_id, original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url, width, height, content_hash, derivatives_complete, ready_for_public_render, original_stored, status, date_uploaded) VALUES ('" + slug + "', '" + title_escaped + "', " + str(gallery_id) + ", '" + original_r2_key + "', '" + thumb_url + "', '" + small_url + "', '" + medium_url + "', '" + large_url + "', '" + preview_url + "', " + str(width) + ", " + str(height) + ", '" + content_hash + "', true, true, true, 'active', NOW()) RETURNING id;"
    cmd = "PGPASSWORD=npg_BvF2JsQ8drba psql -h ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech -U neondb_owner -d wildphotography -t -c \"" + sql + "\" 2>&1"
    result = run_cmd(cmd)
    if result and result.strip():
        return result.strip()
    return None

def generate_derivatives(source_path, output_dir, base_name):
    for size, suffix, max_dim in DERIVATIVES:
        output_path = os.path.join(output_dir, base_name + "_" + suffix + ".jpg")
        cmd = 'magick "' + source_path + '" -resize "' + str(max_dim) + 'x' + str(max_dim) + '>" -quality 85 -auto-orient "' + output_path + '"'
        result = run_cmd(cmd, capture=False)
        if result is None:
            return False
    return True

def process_photo(item, gallery_slug):
    source_path = item["source_path"]
    filename = item["filename"]
    content_hash = item["content_hash"]
    gallery_id = item["gallery_id"]
    
    if not os.path.exists(source_path):
        return None, "source_not_found", "File not found: " + source_path
    
    if check_duplicate_hash(content_hash):
        return None, "duplicate_hash", "Hash " + content_hash[:16] + "... already in DB"
    
    slug = generate_slug(filename)
    
    dims = run_cmd('identify -format "%w %h" "' + source_path + '"')
    if not dims:
        return None, "dimension_error", "Could not get image dimensions"
    try:
        parts = dims.split()
        width = int(parts[0])
        height = int(parts[1])
    except:
        return None, "dimension_parse_error", "Could not parse: " + dims
    
    title = filename.replace(".jpg", "").replace(".JPG", "").replace("-", " ").replace("_", " ")
    
    original_r2_key = "originals/" + gallery_slug + "/" + content_hash + ".jpg"
    
    print("    Uploading original...")
    if not upload_to_r2(source_path, original_r2_key):
        return None, "upload_failed", "Failed to upload original to R2"
    
    deriv_dir = "/tmp/wildphoto_derivatives"
    os.makedirs(deriv_dir, exist_ok=True)
    
    print("    Generating derivatives...")
    base_name = content_hash[:12]
    if not generate_derivatives(source_path, deriv_dir, base_name):
        return None, "derivative_error", "Failed to generate derivatives"
    
    deriv_urls = {}
    for size, suffix, max_dim in DERIVATIVES:
        deriv_path = os.path.join(deriv_dir, base_name + "_" + suffix + ".jpg")
        deriv_key = "derivatives/" + gallery_slug + "/" + base_name + "_" + suffix + ".jpg"
        print("    Uploading " + suffix + "...")
        if not upload_to_r2(deriv_path, deriv_key):
            return None, "derivative_upload_failed", "Failed to upload " + suffix
        deriv_urls[suffix] = "https://pub-" + R2_ACCOUNT_ID + "." + R2_BUCKET + ".r2.dev/" + deriv_key
    
    for f in os.listdir(deriv_dir):
        try:
            os.remove(os.path.join(deriv_dir, f))
        except:
            pass
    
    print("    Inserting into DB...")
    photo_id = insert_photo_record(
        slug, title, original_r2_key, gallery_id,
        deriv_urls.get("thumb", ""), deriv_urls.get("small", ""), 
        deriv_urls.get("medium", ""), deriv_urls.get("large", ""), 
        deriv_urls.get("preview", ""),
        width, height, content_hash, item.get("size", 0)
    )
    
    if photo_id:
        return photo_id, "success", None
    else:
        return None, "db_insert_failed", "DB insert returned no ID"

def main():
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    queue_path = "/Users/joshuatenbrink/.openclaw/workspace/photo_import_pending_queue_archive_batch2_20260429.json"
    with open(queue_path) as f:
        queue_data = json.load(f)
    
    items = queue_data.get("items", [])
    print("Loaded " + str(len(items)) + " items from queue")
    print("Galleries: " + str(queue_data.get("galleries_represented", [])))
    
    results = {
        "run_at": datetime.now().isoformat(),
        "batch": "20260429_batch2",
        "folders_processed": [],
        "photos_processed": 0,
        "duplicates_skipped": 0,
        "filename_collisions_renamed": 0,
        "originals_uploaded": 0,
        "derivatives_generated": 0,
        "ready_for_public_render": 0,
        "failed": 0,
        "failed_details": [],
        "galleries_used": {}
    }
    
    folders_set = set()
    
    for i, item in enumerate(items):
        gallery_slug = item["gallery_slug"]
        gallery_id = item["gallery_id"]
        
        folders_set.add(gallery_slug)
        
        print("\n[" + str(i+1) + "/" + str(len(items)) + "] " + item["filename"])
        print("  Gallery: " + gallery_slug + " (id=" + str(gallery_id) + ")")
        
        photo_id, status, detail = process_photo(item, gallery_slug)
        
        if status == "success":
            results["photos_processed"] += 1
            results["originals_uploaded"] += 1
            results["derivatives_generated"] += 5
            results["ready_for_public_render"] += 1
            print("  SUCCESS: photo_id=" + str(photo_id))
            
            if gallery_slug not in results["galleries_used"]:
                results["galleries_used"][gallery_slug] = 0
            results["galleries_used"][gallery_slug] += 1
        elif status == "duplicate_hash":
            results["duplicates_skipped"] += 1
            print("  SKIPPED (duplicate): " + str(detail))
        else:
            results["failed"] += 1
            results["failed_details"].append({
                "filename": item["filename"],
                "source_path": item["source_path"],
                "status": status,
                "detail": detail
            })
            print("  FAILED: " + status + " - " + str(detail))
    
    results["folders_processed"] = list(folders_set)
    
    print("\n" + "="*60)
    print("BATCH RESULTS")
    print("="*60)
    print("Folders processed: " + str(results["folders_processed"]))
    print("Photos processed: " + str(results["photos_processed"]))
    print("Duplicates skipped: " + str(results["duplicates_skipped"]))
    print("Originals uploaded: " + str(results["originals_uploaded"]))
    print("Derivatives generated: " + str(results["derivatives_generated"]))
    print("Ready for public render: " + str(results["ready_for_public_render"]))
    print("Failed: " + str(results["failed"]))
    print("Gallery breakdown: " + str(results["galleries_used"]))
    if results["failed_details"]:
        print("Failures: " + str(results["failed_details"][:3]))
    
    report_path = "/Users/joshuatenbrink/.openclaw/workspace/wild_import_batch_20260429_2_report_" + run_ts + ".json"
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
    print("\nReport saved: " + report_path)
    
    return results

if __name__ == "__main__":
    main()
