#!/usr/bin/env python3
"""
WildPhotography Import Manager - Batch 2
Process up to 100 photos from the Costa Rica Birds queue
"""
import os
import json
import hashlib
import uuid
from datetime import datetime
from PIL import Image
import boto3
import psycopg2
import requests

# Configuration
R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
R2_BUCKET = "wildphoto-storage"
R2_PUBLIC_DOMAIN = "pub-7d412c6efb5943b5bc587e695e22001e.r2.dev"
AWS_ACCESS_KEY_ID = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_ACCESS_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

QUEUE_PATH = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/import_batch_active.json"

# Gallery folder to ID/slug mapping
GALLERY_MAP = {
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
    "Costa-Rica-Gallery/Santa-Teresa-Malpais": (91, "santa-teresa-malpais"),
}

# Derivative sizes
DERIVATIVES = {
    "thumb": (200, 200),
    "small": (640, 480),
    "medium": (1280, 960),
    "large": (2560, 1920),
    "preview": (1920, 1440)
}

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )

def get_db_connection():
    return psycopg2.connect(NEON_CONN)

def load_queue():
    with open(QUEUE_PATH, 'r') as f:
        data = json.load(f)
        # Handle both dict with 'items' key and plain list
        if isinstance(data, dict) and 'items' in data:
            return data['items']
        return data

def save_queue(items):
    """Save queue items back to the queue file"""
    with open(QUEUE_PATH, 'w') as f:
        json.dump(items, f, indent=2)

def get_pending_items(queue, limit=100):
    return [x for x in queue if isinstance(x, dict) and x.get('status') == 'pending'][:limit]

def check_duplicate(cur, content_hash):
    cur.execute("SELECT id FROM photos WHERE content_hash = %s", (content_hash,))
    return cur.fetchone() is not None

def generate_derivatives(source_path, content_hash, temp_dir):
    """Generate all 5 derivatives and return their paths"""
    derivatives = {}
    
    try:
        with Image.open(source_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            original_width, original_height = img.size
            orientation = 'Landscape'
            if original_height > original_width:
                orientation = 'Portrait'
            elif original_width == original_height:
                orientation = 'Square'
            
            for name, (max_w, max_h) in DERIVATIVES.items():
                # Resize maintaining aspect ratio
                img_copy = img.copy()
                img_copy.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
                
                output_path = os.path.join(temp_dir, f"{content_hash[:16]}_{name}.jpg")
                img_copy.save(output_path, 'JPEG', quality=85, optimize=True)
                derivatives[name] = output_path
                
    except Exception as e:
        print(f"Error generating derivatives for {source_path}: {e}")
        return None, None, orientation if 'orientation' in locals() else 'Landscape'
    
    return derivatives, orientation

def upload_to_r2(s3_client, local_path, r2_key):
    """Upload a file to R2"""
    try:
        with open(local_path, 'rb') as f:
            s3_client.upload_fileobj(f, R2_BUCKET, r2_key)
        return True
    except Exception as e:
        print(f"Error uploading {local_path} to R2: {e}")
        return False

def insert_photo_record(cur, data, r2_keys, gallery_id, gallery_slug, derivatives_complete=True):
    """Insert photo record into database"""
    slug = f"{gallery_slug}-{uuid.uuid4().hex[:8]}"
    
    # Build URLs from R2 keys
    base_url = f"https://{R2_PUBLIC_DOMAIN}/"
    thumb_url = base_url + r2_keys.get('thumb', '') if r2_keys.get('thumb') else None
    small_url = base_url + r2_keys.get('small', '') if r2_keys.get('small') else None
    medium_url = base_url + r2_keys.get('medium', '') if r2_keys.get('medium') else None
    large_url = base_url + r2_keys.get('large', '') if r2_keys.get('large') else None
    preview_url = base_url + r2_keys.get('preview', '') if r2_keys.get('preview') else None
    
    sql = """
    INSERT INTO photos (
        filename, slug, gallery_id, gallery_slug, original_r2_key,
        r2_thumb_key, r2_web_small_key, r2_web_large_key, r2_print_key,
        thumb_url, small_url, medium_url, large_url, preview_url,
        content_hash, source_path, width, height, orientation,
        derivatives_complete, ready_for_public_render, search_ready,
        original_stored, date_uploaded
    ) VALUES (
        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
    ) RETURNING id
    """
    
    values = (
        data['filename'],
        slug,
        gallery_id,
        gallery_slug,
        r2_keys['original'],
        r2_keys.get('thumb'),
        r2_keys.get('small'),
        r2_keys.get('large'),
        r2_keys.get('preview'),
        thumb_url,
        small_url,
        medium_url,
        large_url,
        preview_url,
        data['content_hash'],
        data['source_path'],
        None,  # width - could extract from image
        None,  # height
        'Landscape',  # orientation - could extract
        derivatives_complete,
        derivatives_complete,  # ready_for_public_render
        derivatives_complete,  # search_ready
        True,  # original_stored
        datetime.now()
    )
    
    cur.execute(sql, values)
    return cur.fetchone()[0]

def process_batch():
    """Main processing function"""
    print("Starting batch import...")
    
    # Load queue
    queue = load_queue()
    pending = get_pending_items(queue, limit=100)
    print(f"Processing {len(pending)} pending items")
    
    # Get DB connection
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get S3 client
    s3_client = get_s3_client()
    
    # Stats
    stats = {
        'photos_processed': 0,
        'duplicates_skipped': 0,
        'filename_collisions_renamed': 0,
        'originals_uploaded': 0,
        'derivatives_generated': 0,
        'ready_for_public_render_count': 0,
        'failed_files': []
    }
    
    # Temp directory for derivatives
    temp_dir = "/tmp/wildphoto_import"
    os.makedirs(temp_dir, exist_ok=True)
    
    for item in pending:
        # Extract or derive required fields
        source_path = item['source_path']
        gallery_folder = item.get('gallery_folder', '')
        
        # Use per-item gallery_id and gallery_slug (set by build script)
        gallery_id = item.get('gallery_id', GALLERY_MAP.get(gallery_folder, (5, 'unknown'))[0])
        gallery_slug = item.get('gallery_slug', GALLERY_MAP.get(gallery_folder, (5, 'unknown'))[1])
        
        # Derive filename from source_path if not present
        filename = item.get('filename') or os.path.basename(source_path)
        
        # Compute content_hash from source file if not present
        content_hash = item.get('content_hash')
        if not content_hash:
            if os.path.exists(source_path):
                with open(source_path, 'rb') as f:
                    content_hash = hashlib.sha256(f.read()).hexdigest()
            else:
                content_hash = hashlib.sha256(source_path.encode()).hexdigest()[:64]
        
        print(f"\nProcessing: {filename}")
        
        # Check for duplicate by content hash
        if check_duplicate(cur, content_hash):
            print(f"  -> Duplicate detected, skipping")
            stats['duplicates_skipped'] += 1
            # Mark as completed in queue
            item['status'] = 'completed'
            item['skip_reason'] = 'duplicate'
            continue
        
        # Verify source file exists
        if not os.path.exists(source_path):
            print(f"  -> Source file not found: {source_path}")
            stats['failed_files'].append(source_path)
            item['attempt_count'] = item.get('attempt_count', 0) + 1
            continue
        
        try:
            # Generate derivatives
            derivatives, orientation = generate_derivatives(source_path, content_hash, temp_dir)
            if derivatives is None:
                raise Exception("Failed to generate derivatives")
            
            stats['derivatives_generated'] += 5  # 5 derivatives per photo
            
            # Upload original to R2
            original_r2_key = f"originals/{content_hash}.jpg"
            if upload_to_r2(s3_client, source_path, original_r2_key):
                stats['originals_uploaded'] += 1
            else:
                raise Exception("Failed to upload original")
            
            # Upload derivatives to R2
            r2_keys = {'original': original_r2_key}
            for name, path in derivatives.items():
                key_name = f"derivatives/{content_hash[:16]}_{name}.jpg"
                if upload_to_r2(s3_client, path, key_name):
                    if name == 'thumb':
                        r2_keys['thumb'] = key_name
                    elif name == 'small':
                        r2_keys['small'] = key_name
                    elif name == 'medium':
                        r2_keys['medium'] = key_name
                    elif name == 'large':
                        r2_keys['large'] = key_name
                    elif name == 'preview':
                        r2_keys['preview'] = key_name
            
            # Insert database record
            photo_id = insert_photo_record(cur, item, r2_keys, gallery_id, gallery_slug, derivatives_complete=True)
            
            # Commit
            conn.commit()
            
            stats['photos_processed'] += 1
            stats['ready_for_public_render_count'] += 1
            
            # Mark as completed in queue
            item['status'] = 'completed'
            item['db_id'] = photo_id
            
            print(f"  -> Completed (ID: {photo_id})")
            
        except Exception as e:
            print(f"  -> Error: {e}")
            stats['failed_files'].append(source_path)
            item['attempt_count'] = item.get('attempt_count', 0) + 1
            conn.rollback()
    
    # Save updated queue
    save_queue(queue)
    
    # Cleanup temp files
    for f in os.listdir(temp_dir):
        os.remove(os.path.join(temp_dir, f))
    
    cur.close()
    conn.close()
    
    print("\n" + "="*50)
    print("BATCH IMPORT COMPLETE")
    print("="*50)
    for k, v in stats.items():
        print(f"  {k}: {v}")
    
    return stats

if __name__ == "__main__":
    process_batch()
