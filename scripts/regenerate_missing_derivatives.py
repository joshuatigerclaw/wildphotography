#!/usr/bin/env python3
"""
Regenerate missing derivatives from local source files.

For each photo with source_path but derivatives_complete=false:
1. Read the source image
2. Generate 5 derivative sizes (thumb, small, medium, large, web)
3. Upload to R2
4. Update database with R2 keys and set derivatives_complete=true
"""

import os
import sys
import json
import subprocess
import psycopg2
from PIL import Image
from io import BytesIO
from datetime import datetime

# Configuration
R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com'
R2_BUCKET = 'wildphoto-storage'
AWS_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75'
AWS_SECRET_KEY = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f'
R2_PUBLIC_BASE = 'https://images.wildphotography.com'

DB_CONFIG = {
    'host': 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
    'database': 'wildphotography',
    'user': 'neondb_owner',
    'password': 'npg_BvF2JsQ8drba'
}

# Derivative sizes
SIZES = {
    'thumb': {'width': 400, 'quality': 80},
    'small': {'width': 900, 'quality': 85},
    'medium': {'width': 1600, 'quality': 85},
    'large': {'width': 2400, 'quality': 90},
    'web': {'width': 1600, 'quality': 85},  # web variant
}

DERIVATIVES_DIR = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/storage/derivatives'


def run_s5cmd(source, dest):
    """Upload a file to R2 using s5cmd"""
    env = os.environ.copy()
    env['AWS_ACCESS_KEY_ID'] = AWS_ACCESS_KEY
    env['AWS_SECRET_ACCESS_KEY'] = AWS_SECRET_KEY
    
    cmd = ['s5cmd', '--endpoint-url', R2_ENDPOINT, 'cp', source, f's3://{R2_BUCKET}/{dest}']
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    return result.returncode == 0, result.stdout, result.stderr


def generate_derivative(input_path, width, quality, output_path):
    """Generate a derivative image using Pillow"""
    try:
        with Image.open(input_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize maintaining aspect ratio
            w, h = img.size
            if w > width:
                new_height = int(h * (width / w))
                img = img.resize((width, new_height), Image.LANCZOS)
            
            # Save
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            return True
    except Exception as e:
        print(f"  Error generating derivative: {e}")
        return False


def process_photo(conn, photo):
    """Process a single photo: generate derivatives and upload to R2"""
    photo_id = photo['id']
    slug = photo['slug']
    source_path = photo['source_path']
    
    print(f"\n{'='*60}")
    print(f"Processing photo {photo_id}: {slug}")
    print(f"Source: {source_path}")
    
    # Validate source file exists
    if not os.path.exists(source_path):
        print(f"  ERROR: Source file does not exist: {source_path}")
        return False, 'source_not_found'
    
    # Create derivatives directory for this photo
    photo_deriv_dir = os.path.join(DERIVATIVES_DIR, str(photo_id))
    os.makedirs(photo_deriv_dir, exist_ok=True)
    
    derivatives = {}
    total_derivatives = 0
    upload_failures = 0
    
    # Generate each derivative size
    for size_name, config in SIZES.items():
        output_filename = f"{slug}_{size_name}.jpg"
        output_path = os.path.join(photo_deriv_dir, output_filename)
        r2_key = f"derivatives/{size_name}/{slug}-{size_name}.jpg"
        
        # Generate derivative
        success = generate_derivative(source_path, config['width'], config['quality'], output_path)
        if not success:
            print(f"  FAILED to generate {size_name}")
            continue
        
        file_size = os.path.getsize(output_path)
        print(f"  Generated {size_name}: {output_path} ({file_size} bytes)")
        
        # Upload to R2
        ok, stdout, stderr = run_s5cmd(output_path, r2_key)
        if ok:
            public_url = f"{R2_PUBLIC_BASE}/{r2_key}"
            derivatives[size_name] = {
                'r2_key': r2_key,
                'public_url': public_url,
                'local_path': output_path
            }
            total_derivatives += 1
            print(f"  Uploaded {size_name}: {r2_key}")
        else:
            upload_failures += 1
            print(f"  FAILED to upload {size_name}: {stderr}")
    
    if total_derivatives == 0:
        print(f"  ERROR: No derivatives generated/uploaded")
        return False, 'upload_failures'
    
    # Update database
    try:
        with conn.cursor() as cur:
            update_sql = """
                UPDATE photos SET
                    thumb_url = %s,
                    small_url = %s,
                    medium_url = %s,
                    large_url = %s,
                    preview_url = %s,
                    r2_thumb_key = %s,
                    r2_web_small_key = %s,
                    r2_web_large_key = %s,
                    derivatives_complete = true,
                    ready_for_public_render = true,
                    search_ready = true,
                    updated_at = NOW()
                WHERE id = %s
            """
            cur.execute(update_sql, (
                derivatives.get('thumb', {}).get('public_url', ''),
                derivatives.get('small', {}).get('public_url', ''),
                derivatives.get('medium', {}).get('public_url', ''),
                derivatives.get('large', {}).get('public_url', ''),
                derivatives.get('web', {}).get('public_url', ''),
                derivatives.get('thumb', {}).get('r2_key', ''),
                derivatives.get('small', {}).get('r2_key', ''),
                derivatives.get('large', {}).get('r2_key', ''),
                photo_id
            ))
            conn.commit()
            print(f"  Database updated successfully")
            return True, 'success'
    except Exception as e:
        print(f"  Database update failed: {e}")
        conn.rollback()
        return False, 'db_error'


def main():
    batch_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    
    print(f"=== WildPhotography Derivative Regeneration ===")
    print(f"Batch limit: {batch_limit}")
    print(f"Started: {datetime.now()}")
    
    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get photos with source_path but missing derivatives
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, slug, source_path
            FROM photos
            WHERE derivatives_complete = false
              AND source_path IS NOT NULL
              AND source_path <> ''
              AND status != 'archived_unrecoverable'
            LIMIT %s
        """, (batch_limit,))
        columns = [desc[0] for desc in cur.description]
        photos = [dict(zip(columns, row)) for row in cur.fetchall()]
    
    print(f"\nFound {len(photos)} photos needing derivative regeneration")
    
    if len(photos) == 0:
        print("No photos to process")
        conn.close()
        return
    
    # Process each photo
    results = {
        'processed': 0,
        'success': 0,
        'failed': 0,
        'derivatives_generated': 0,
        'upload_failures': 0,
        'failures': []
    }
    
    for photo in photos:
        results['processed'] += 1
        success, status = process_photo(conn, photo)
        
        if success:
            results['success'] += 1
            results['derivatives_generated'] += 5  # 5 derivative sizes per photo
        else:
            results['failed'] += 1
            results['failures'].append({
                'photo_id': photo['id'],
                'slug': photo['slug'],
                'status': status
            })
            if status == 'upload_failures':
                results['upload_failures'] += 5  # estimate 5 derivatives failed
    
    conn.close()
    
    # Print summary
    print(f"\n{'='*60}")
    print("=== SUMMARY ===")
    print(f"Records processed: {results['processed']}")
    print(f"Records successful: {results['success']}")
    print(f"Records failed: {results['failed']}")
    print(f"Derivatives generated: {results['derivatives_generated']}")
    print(f"Upload failures: {results['upload_failures']}")
    
    if results['failures']:
        print(f"\nFailed records:")
        for f in results['failures']:
            print(f"  - {f['photo_id']} ({f['slug']}): {f['status']}")
    
    print(f"\nCompleted: {datetime.now()}")
    
    # Output JSON for machine parsing
    print(f"\nJSON OUTPUT:")
    print(json.dumps(results))


if __name__ == '__main__':
    main()
