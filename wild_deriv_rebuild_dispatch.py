#!/usr/bin/env python3
"""
WildPhotography Derivative Rebuild Dispatcher
Process up to 25 items from derivative_rebuild_queue with resolution='already_complete'

For each photo:
1. Download original from R2
2. Generate 4 derivative sizes (thumb 300px, small 600px, medium 1200px, large 2000px)
3. Upload derivatives to R2
4. Update photos table with R2 keys
5. Update queue status to 'completed'
"""

import os
import sys
import json
import subprocess
import tempfile
import psycopg2
from PIL import Image
from datetime import datetime
import boto3
from botocore.config import Config

# Configuration
R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com'
R2_BUCKET = 'wildphoto-storage'
R2_PUBLIC_BASE = 'https://images.wildphotography.com'
AWS_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75'
AWS_SECRET_KEY = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f'

DB_CONFIG = {
    'host': 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
    'database': 'wildphotography',
    'user': 'neondb_owner',
    'password': 'npg_BvF2JsQ8drba'
}

# Derivative sizes (as specified in task)
SIZES = {
    'thumb': {'width': 300, 'quality': 80},
    'small': {'width': 600, 'quality': 85},
    'medium': {'width': 1200, 'quality': 85},
    'large': {'width': 2000, 'quality': 90},
}

def get_r2_client():
    """Create boto3 R2 client"""
    return boto3.client('s3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name='auto'
    )

def download_from_r2(r2_key, local_path):
    """Download a file from R2"""
    client = get_r2_client()
    try:
        client.download_file(R2_BUCKET, r2_key, local_path)
        return True
    except Exception as e:
        print(f"    Download failed: {e}")
        return False

def upload_to_r2(local_path, r2_key):
    """Upload a file to R2 using s5cmd"""
    env = os.environ.copy()
    env['AWS_ACCESS_KEY_ID'] = AWS_ACCESS_KEY
    env['AWS_SECRET_ACCESS_KEY'] = AWS_SECRET_KEY
    
    cmd = ['s5cmd', '--endpoint-url', R2_ENDPOINT, 'cp', local_path, f's3://{R2_BUCKET}/{r2_key}']
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
            
            # Save as JPEG
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            return True
    except Exception as e:
        print(f"    Error generating derivative: {e}")
        return False

def extract_r2_key_from_url(url):
    """"Extract the R2 key from a full URL or return the key as-is"""
    if not url:
        return None
    
    if url.startswith('http'):
        # URL like https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/photos/gallery/xx/file.jpg
        # Extract the key after the domain
        parts = url.split('/')
        for i, part in enumerate(parts):
            if part == 'photos' and i + 1 < len(parts):
                return '/'.join(parts[i:])
        return None
    else:
        return url

def get_deriv_r2_key(photo_id, slug, size_name, original_key):
    """Get the canonical R2 key for a derivative"""
    # Canonical pattern: derivatives/{photo_id}/{slug}_{size}.jpg
    return f"derivatives/{photo_id}/{slug}_{size_name}.jpg"

def process_photo(conn, queue_item):
    """Process a single photo: download original, generate derivatives, upload to R2"""
    photo_id = queue_item['photo_id']
    queue_id = queue_item['id']
    slug = queue_item['slug']
    original_r2_key = queue_item.get('original_r2_key') or queue_item.get('r2_original_key')
    
    print(f"\n{'='*60}")
    print(f"Processing photo {photo_id} (queue {queue_id}): {slug}")
    print(f"Original R2 key: {original_r2_key}")
    
    if not original_r2_key:
        print(f"  ERROR: No original R2 key found")
        return False, 'no_original_key'
    
    # Extract actual R2 key from URL if needed
    actual_key = extract_r2_key_from_url(original_r2_key)
    if not actual_key:
        print(f"  ERROR: Could not extract R2 key from {original_r2_key}")
        return False, 'invalid_original_key'
    
    # Create temp directory
    temp_dir = tempfile.mkdtemp(prefix=f'wild_deriv_{photo_id}_')
    original_path = os.path.join(temp_dir, 'original.jpg')
    
    # Download original from R2
    print(f"  Downloading original from R2: {actual_key}")
    if not download_from_r2(actual_key, original_path):
        print(f"  ERROR: Failed to download original")
        # Cleanup
        subprocess.run(['rm', '-rf', temp_dir], capture_output=True)
        return False, 'download_failed'
    
    file_size = os.path.getsize(original_path)
    print(f"  Downloaded: {original_path} ({file_size} bytes)")
    
    derivatives = {}
    total_derivatives = 0
    upload_failures = 0
    
    # Generate each derivative size
    for size_name, config in SIZES.items():
        output_filename = f"{size_name}.jpg"
        output_path = os.path.join(temp_dir, output_filename)
        r2_key = get_deriv_r2_key(photo_id, slug, size_name, original_r2_key)
        
        # Generate derivative
        success = generate_derivative(original_path, config['width'], config['quality'], output_path)
        if not success:
            print(f"  FAILED to generate {size_name}")
            upload_failures += 1
            continue
        
        deriv_size = os.path.getsize(output_path)
        print(f"  Generated {size_name}: {deriv_size} bytes")
        
        # Upload to R2
        ok, stdout, stderr = upload_to_r2(output_path, r2_key)
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
    
    # Cleanup temp directory
    subprocess.run(['rm', '-rf', temp_dir], capture_output=True)
    
    if total_derivatives == 0:
        print(f"  ERROR: No derivatives generated/uploaded")
        return False, 'no_derivatives'
    
    # Update database
    try:
        with conn.cursor() as cur:
            # Build update SQL based on available derivatives
            updates = []
            values = []
            
            if 'thumb' in derivatives:
                updates.append("r2_thumb_key = %s")
                updates.append("thumb_url = %s")
                values.append(derivatives['thumb']['r2_key'])
                values.append(derivatives['thumb']['public_url'])
            
            if 'small' in derivatives:
                updates.append("r2_web_small_key = %s")
                updates.append("small_url = %s")
                values.append(derivatives['small']['r2_key'])
                values.append(derivatives['small']['public_url'])
            
            if 'medium' in derivatives:
                updates.append("medium_url = %s")
                values.append(derivatives['medium']['public_url'])
            
            if 'large' in derivatives:
                updates.append("r2_web_large_key = %s")
                updates.append("large_url = %s")
                values.append(derivatives['large']['r2_key'])
                values.append(derivatives['large']['public_url'])
            
            # Always update these flags
            updates.append("derivatives_complete = true")
            updates.append("ready_for_public_render = true")
            updates.append("updated_at = NOW()")
            
            # Append photo_id for WHERE clause
            values.append(photo_id)
            
            update_sql = f"""
                UPDATE photos SET
                    {', '.join(updates)}
                WHERE id = %s
            """
            cur.execute(update_sql, values)
            conn.commit()
            print(f"  Database updated successfully")
            
            # Update queue status
            cur.execute("""
                UPDATE derivative_rebuild_queue 
                SET status = 'completed', resolution = 'regenerated_derivatives', date_modified = NOW()
                WHERE id = %s
            """, (queue_id,))
            conn.commit()
            print(f"  Queue updated to completed")
            
            return True, 'success'
    except Exception as e:
        print(f"  Database update failed: {e}")
        conn.rollback()
        return False, 'db_error'

def main():
    batch_limit = 25
    
    print(f"=== WildPhotography Derivative Rebuild Dispatcher ===")
    print(f"Batch limit: {batch_limit}")
    print(f"Started: {datetime.now()}")
    
    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get queue items with resolution='already_complete'
    with conn.cursor() as cur:
        cur.execute("""
            SELECT q.id, q.photo_id, q.status, q.resolution,
                   p.slug, p.original_r2_key, p.r2_original_key,
                   p.thumb_url, p.small_url, p.medium_url, p.large_url,
                   p.derivatives_complete, p.ready_for_public_render
            FROM derivative_rebuild_queue q
            JOIN photos p ON p.id = q.photo_id
            WHERE q.resolution = 'already_complete'
              AND q.status IN ('pending', 'processed')
            ORDER BY q.date_modified ASC
            LIMIT %s
        """, (batch_limit,))
        columns = [desc[0] for desc in cur.description]
        queue_items = [dict(zip(columns, row)) for row in cur.fetchall()]
    
    print(f"\nFound {len(queue_items)} queue items to process")
    
    if len(queue_items) == 0:
        print("No items to process")
        conn.close()
        return
    
    # Process each item
    results = {
        'processed': 0,
        'success': 0,
        'failed': 0,
        'derivatives_generated': 0,
        'upload_failures': 0,
        'photos': [],
        'failures': []
    }
    
    for item in queue_items:
        results['processed'] += 1
        success, status = process_photo(conn, item)
        
        photo_result = {
            'photo_id': item['photo_id'],
            'queue_id': item['id'],
            'slug': item['slug'],
            'status': status
        }
        
        if success:
            results['success'] += 1
            results['derivatives_generated'] += 4  # 4 derivative sizes per photo
            photo_result['derivatives'] = ['thumb', 'small', 'medium', 'large']
        else:
            results['failed'] += 1
            if status == 'upload_failures':
                results['upload_failures'] += 4
            photo_result['error'] = status
        
        results['photos'].append(photo_result)
        results['failures'].append(photo_result)
    
    conn.close()
    
    # Print summary
    print(f"\n{'='*60}")
    print("=== SUMMARY ===")
    print(f"Items processed: {results['processed']}")
    print(f"Items successful: {results['success']}")
    print(f"Items failed: {results['failed']}")
    print(f"Derivatives generated: {results['derivatives_generated']}")
    print(f"Upload failures: {results['upload_failures']}")
    
    if results['failures']:
        print(f"\nFailed items:")
        for f in results['failures']:
            print(f"  - photo_id={f['photo_id']} queue_id={f['queue_id']} ({f['slug']}): {f.get('error', 'unknown')}")
    
    print(f"\nCompleted: {datetime.now()}")
    
    # Write report
    report_path = os.path.expanduser('~/wild_deriv_rebuild_dispatch_20260615_0845UTC.md')
    report = f"""# WildPhotography Derivative Rebuild Dispatch Report

**Run Date:** 2026-06-15 08:45 UTC  
**Session:** wild-deriv-rebuild-dispatch

## Summary

- Items processed: {results['processed']}
- Items successful: {results['success']}
- Items failed: {results['failed']}
- Derivatives generated: {results['derivatives_generated']}
- Upload failures: {results['upload_failures']}

## Processed Photos

| Photo ID | Queue ID | Slug | Status | Derivatives |
|----------|----------|------|--------|-------------|
"""
    
    for p in results['photos']:
        derivs = ','.join(p.get('derivatives', [])) if 'derivatives' in p else 'FAILED'
        report += f"| {p['photo_id']} | {p['queue_id']} | {p['slug']} | {p.get('error', 'success')} | {derivs} |\n"
    
    report += f"""
## Failures

"""
    for f in results['failures']:
        report += f"- photo_id={f['photo_id']}: {f.get('error', 'unknown')}\n"
    
    with open(report_path, 'w') as f:
        f.write(report)
    
    print(f"\nReport written to: {report_path}")
    
    # Output JSON for machine parsing
    print(f"\nJSON OUTPUT:")
    print(json.dumps(results, indent=2, default=str))

if __name__ == '__main__':
    main()
