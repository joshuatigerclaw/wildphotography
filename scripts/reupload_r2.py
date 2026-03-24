#!/usr/bin/env python3
"""
Re-run R2 uploads for the batch that was just imported
"""

import os
import subprocess
import psycopg2

# Configuration
OUTPUT_DIR = "/Users/joshuatenbrink/.openclaw/workspace/WildPhotography/storage/derivatives"
R2_BUCKET = "wildphoto-storage"
R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
AWS_ACCESS_KEY = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"

DB_CONFIG = {
    'host': 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
    'database': 'wildphotography',
    'user': 'neondb_owner',
    'password': 'npg_BvF2JsQ8drba'
}

def run_command(cmd):
    """Run a shell command"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode == 0, result.stdout, result.stderr

def upload_to_r2(source_path, key):
    """Upload a file to R2 using s5cmd"""
    env = f'AWS_ACCESS_KEY_ID="{AWS_ACCESS_KEY}" AWS_SECRET_ACCESS_KEY="{AWS_SECRET_KEY}"'
    cmd = f'{env} s5cmd --endpoint-url "{R2_ENDPOINT}" cp "{source_path}" "s3://{R2_BUCKET}/{key}"'
    success, stdout, stderr = run_command(cmd)
    return success

def main():
    print("Re-uploading files to R2...")
    
    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get photos from the recent batch that might be missing R2 files
    # We'll get all photos that were imported in the last batch (gallery_slug = 'birds')
    with conn.cursor() as cur:
        # Get the most recent 100 photos from birds gallery
        cur.execute("""
            SELECT id, content_hash, r2_original_key, r2_thumb_key, r2_web_small_key, r2_web_large_key 
            FROM photos 
            WHERE gallery_slug = 'birds' 
            ORDER BY id DESC 
            LIMIT 100
        """)
        photos = cur.fetchall()
    
    print(f"Checking {len(photos)} photos...")
    
    upload_count = 0
    error_count = 0
    
    for photo_id, content_hash, r2_orig_key, r2_thumb_key, r2_small_key, r2_large_key in photos:
        # Check if we have local derivatives
        thumb_path = os.path.join(OUTPUT_DIR, f"{content_hash}_thumb.jpg")
        small_path = os.path.join(OUTPUT_DIR, f"{content_hash}_small.jpg")
        medium_path = os.path.join(OUTPUT_DIR, f"{content_hash}_medium.jpg")
        large_path = os.path.join(OUTPUT_DIR, f"{content_hash}_large.jpg")
        preview_path = os.path.join(OUTPUT_DIR, f"{content_hash}_preview.jpg")
        
        # Upload derivatives
        if os.path.exists(thumb_path) and r2_thumb_key:
            print(f"  Uploading thumb: {r2_thumb_key}")
            if upload_to_r2(thumb_path, r2_thumb_key):
                upload_count += 1
            else:
                error_count += 1
        
        if os.path.exists(small_path) and r2_small_key:
            print(f"  Uploading small: {r2_small_key}")
            if upload_to_r2(small_path, r2_small_key):
                upload_count += 1
            else:
                error_count += 1
        
        if os.path.exists(medium_path):
            # No medium key stored, but upload anyway
            medium_key = f"derivatives/medium/{content_hash}.jpg"
            print(f"  Uploading medium: {medium_key}")
            if upload_to_r2(medium_path, medium_key):
                upload_count += 1
            else:
                error_count += 1
        
        if os.path.exists(large_path) and r2_large_key:
            print(f"  Uploading large: {r2_large_key}")
            if upload_to_r2(large_path, r2_large_key):
                upload_count += 1
            else:
                error_count += 1
        
        if os.path.exists(preview_path):
            preview_key = f"derivatives/preview/{content_hash}.jpg"
            print(f"  Uploading preview: {preview_key}")
            if upload_to_r2(preview_path, preview_key):
                upload_count += 1
            else:
                error_count += 1
    
    conn.close()
    
    print(f"\nUpload complete: {upload_count} files uploaded, {error_count} errors")

if __name__ == '__main__':
    main()
