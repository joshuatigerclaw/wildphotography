#!/usr/bin/env python3
"""
WildPhotography Import Manager - Batch Processor
Processes photos from queue, uploads to R2, generates derivatives, inserts to DB
"""

import json
import os
import subprocess
import time
import hashlib
import re
import sys

# Configuration
R2_ACCOUNT_ID = "3ec62f93675c404fe4a9a4949e38e5e5"
R2_BUCKET = "wildphoto-storage"
DB_CONNECTION = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

GALLERY_ID = 37  # Food- gallery
GALLERY_SLUG = "food-"

# Derivatives config: (size, suffix, max_dim)
DERIVATIVES = [
    (150, "thumb", 150),
    (300, "small", 300),
    (800, "medium", 800),
    (1600, "large", 1600),
    (2400, "preview", 2400),
]

def run_cmd(cmd, capture=True):
    """Run shell command"""
    result = subprocess.run(cmd, shell=True, capture_output=capture, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None
    if capture:
        return result.stdout.strip() if result.stdout else ""
    return True

def generate_derivatives(source_path, output_dir, base_name):
    """Generate all 5 derivatives"""
    for size, suffix, max_dim in DERIVATIVES:
        output_path = os.path.join(output_dir, f"{base_name}_{suffix}.jpg")
        cmd = f'magick "{source_path}" -resize "{max_dim}x{max_dim}>" -quality 85 -auto-orient "{output_path}"'
        result = run_cmd(cmd, capture=False)
        if result is None:
            return False
    return True

def upload_to_r2(file_path, object_key):
    """Upload file to R2 using AWS CLI"""
    endpoint = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    cmd = f'aws s3 cp "{file_path}" "s3://{R2_BUCKET}/{object_key}" --endpoint-url "{endpoint}" --acl public-read'
    result = run_cmd(cmd)
    return result is not None

def generate_slug(filename):
    """Generate slug from filename"""
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Replace spaces and dots with dashes
    slug = re.sub(r'[\s\.]+', '-', name)
    # Remove any non-alphanumeric except dash
    slug = re.sub(r'[^a-zA-Z0-9\-]', '', slug)
    # Lowercase
    slug = slug.lower()
    return slug

def insert_photo_record(slug, title, original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url, width, height, content_hash, size):
    """Insert photo record into database"""
    sql = f'''INSERT INTO photos (
        slug, title, gallery_id, original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url,
        width, height, content_hash, derivatives_complete, ready_for_public_render, original_stored, status, date_uploaded
    ) VALUES (
        '{slug}', '{title}', {GALLERY_ID}, '{original_r2_key}', '{thumb_url}', '{small_url}', '{medium_url}', '{large_url}', '{preview_url}',
        {width}, {height}, '{content_hash}', true, true, true, 'active', NOW()
    ) RETURNING id;'''
    
    cmd = f'''PGPASSWORD=npg_BvF2JsQ8drba psql -h ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech -U neondb_owner -d wildphotography -t -c "{sql}" 2>&1'''
    result = run_cmd(cmd)
    return result

def process_photo(item):
    """Process a single photo"""
    source_path = item['source_path']
    filename = item['filename']
    content_hash = item['content_hash']
    size = item['size']
    
    # Check if source exists
    if not os.path.exists(source_path):
        print(f"  SKIP: Source not found: {source_path}")
        return None, "source_not_found"
    
    # Generate slug
    slug = generate_slug(filename)
    
    # Get image dimensions
    dims = run_cmd(f'identify -format "%w %h" "{source_path}"')
    if not dims:
        print(f"  ERROR: Could not get dimensions")
        return None, "dimension_error"
    width, height = map(int, dims.split())
    
    # Title from filename
    title = filename.replace('.jpg', '').replace('-', ' ')
    
    # R2 object keys
    original_r2_key = f"originals/{GALLERY_SLUG}/{content_hash}.jpg"
    
    # Upload original
    print(f"  Uploading original to R2...")
    if not upload_to_r2(source_path, original_r2_key):
        print(f"  ERROR: Failed to upload original")
        return None, "upload_failed"
    
    # Create temp dir for derivatives
    deriv_dir = "/tmp/wildphoto_derivatives"
    os.makedirs(deriv_dir, exist_ok=True)
    
    # Generate derivatives
    print(f"  Generating derivatives...")
    base_name = content_hash[:12]
    if not generate_derivatives(source_path, deriv_dir, base_name):
        print(f"  ERROR: Failed to generate derivatives")
        return None, "derivative_error"
    
    # Upload derivatives and build URLs
    deriv_urls = {}
    for size, suffix, max_dim in DERIVATIVES:
        deriv_path = os.path.join(deriv_dir, f"{base_name}_{suffix}.jpg")
        deriv_key = f"derivatives/{GALLERY_SLUG}/{base_name}_{suffix}.jpg"
        print(f"    Uploading {suffix}...")
        if not upload_to_r2(deriv_path, deriv_key):
            print(f"  ERROR: Failed to upload {suffix}")
            return None, "derivative_upload_failed"
        deriv_urls[suffix] = f"https://{R2_BUCKET}.{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{deriv_key}"
    
    # Clean up temp files
    for f in os.listdir(deriv_dir):
        os.remove(os.path.join(deriv_dir, f))
    
    # Insert into DB
    print(f"  Inserting into DB...")
    result = insert_photo_record(
        slug, title, original_r2_key,
        deriv_urls.get('thumb', ''), deriv_urls.get('small', ''), 
        deriv_urls.get('medium', ''), deriv_urls.get('large', ''), 
        deriv_urls.get('preview', ''),
        width, height, content_hash, size
    )
    
    if result and result.strip():
        return item['id'], "success"
    else:
        print(f"  ERROR: DB insert failed")
        return None, "db_insert_failed"

def main():
    # Load queue
    queue_path = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/working_import_queue.json"
    with open(queue_path) as f:
        queue = json.load(f)
    
    print(f"Processing {len(queue)} photos from queue...")
    
    results = {
        "processed": 0,
        "duplicates_skipped": 0,
        "filename_collisions_renamed": 0,
        "originals_uploaded": 0,
        "derivatives_generated": 0,
        "ready_for_public_render": 0,
        "failed": 0,
        "failed_paths": []
    }
    
    # Check for duplicates in DB
    hashes = [item['content_hash'] for item in queue]
    dup_check = f'''SELECT content_hash FROM photos WHERE content_hash IN ({','.join(["'"+h+"'" for h in hashes])})'''
    cmd = f'''PGPASSWORD=npg_BvF2JsQ8drba psql -h ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech -U neondb_owner -d wildphotography -t -c "{dup_check}" 2>&1'''
    existing_hashes = set(run_cmd(cmd).strip().split('\n')) if run_cmd(cmd) else set()
    existing_hashes = {h.strip() for h in existing_hashes if h.strip()}
    
    print(f"Found {len(existing_hashes)} existing hashes in DB")
    
    # Process each photo
    for i, item in enumerate(queue):
        print(f"\n[{i+1}/{len(queue)}] Processing: {item['filename']}")
        
        # Check duplicate
        if item['content_hash'] in existing_hashes:
            print(f"  DUPLICATE: Skipping")
            results['duplicates_skipped'] += 1
            continue
        
        # Process photo
        photo_id, status = process_photo(item)
        
        if status == "success":
            results['processed'] += 1
            results['originals_uploaded'] += 1
            results['derivatives_generated'] += 5
            results['ready_for_public_render'] += 1
        else:
            results['failed'] += 1
            results['failed_paths'].append(item['source_path'])
            print(f"  FAILED: {status}")
    
    print(f"\n=== BATCH RESULTS ===")
    print(f"Photos processed: {results['processed']}")
    print(f"Duplicates skipped: {results['duplicates_skipped']}")
    print(f"Filename collisions renamed: {results['filename_collisions_renamed']}")
    print(f"Originals uploaded: {results['originals_uploaded']}")
    print(f"Derivatives generated: {results['derivatives_generated']}")
    print(f"Ready for public render: {results['ready_for_public_render']}")
    print(f"Failed: {results['failed']}")
    if results['failed_paths']:
        print(f"Failed paths: {results['failed_paths'][:5]}...")
    
    # Return summary
    return results

if __name__ == "__main__":
    main()
