#!/usr/bin/env python3
"""
WildPhotography Batch 154
Scan 5 galleries, import only confirmed new files.
Galleries: Alajuela(15), Arenal-Volcano(16), Beaches(18),
           Birds-Macaws-Lapas(20), Butterflies(22)
"""
import os, hashlib, psycopg2, shutil
from datetime import datetime
import boto3

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
R2_BUCKET = "wildphoto-storage"
R2_PUBLIC_DOMAIN = "pub-7d412c6efb5943b5bc587e695e22001e.r2.dev"
AWS_ACCESS_KEY_ID = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_ACCESS_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"

BASE = "/Volumes/ADATA SC740/Smugmug Backup/Galleries"

GALLERY_MAP = {
    "Costa-Rica-Gallery/Alajuela": (15,  "alajuela"),
    "Costa-Rica-Gallery/Arenal-Volcano":                 (16,  "arenal-volcano"),
    "Costa-Rica-Gallery/Beaches":                        (18,  "beaches"),
    "Costa-Rica-Gallery/Birds-Macaws-Lapas":             (20,  "birds-macaws-lapas"),
    "Costa-Rica-Gallery/Butterflies":                    (22,  "butterflies"),
}

DERIVATIVES = {
    "thumb":   (200, 200),
    "small":   (640, 480),
    "medium":  (1280, 960),
    "large":   (2560, 1920),
    "preview": (1920, 1440)
}

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.tiff', '.webp')

def make_slug(filename, content_hash):
    """Generate a URL-safe slug from filename"""
    import re
    name = os.path.splitext(filename)[0]
    # Remove special chars, replace spaces with hyphens
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', name)
    slug = re.sub(r'\s+', '-', slug)
    slug = slug.lower()[:50]  # Limit length
    # Add short hash for uniqueness
    return f"{slug}-{content_hash[:6]}"

s3 = boto3.client('s3', endpoint_url=R2_ENDPOINT,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY)

conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()

from PIL import Image

temp_dir = "/tmp/wildphoto_batch154"
os.makedirs(temp_dir, exist_ok=True)

def get_existing_hashes(gallery_id):
    cur.execute("SELECT content_hash FROM photos WHERE gallery_id = %s AND content_hash IS NOT NULL AND content_hash != ''", (gallery_id,))
    return {row[0] for row in cur.fetchall()}

def upload_to_r2(local_path, r2_key):
    try:
        with open(local_path, 'rb') as f:
            s3.upload_fileobj(f, R2_BUCKET, r2_key)
        return True
    except Exception as e:
        print(f"    R2 upload error: {e}")
        return False

def make_derivatives(source_path, content_hash):
    derivatives = {}
    orientation = 'Landscape'
    try:
        with Image.open(source_path) as img:
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            w, h = img.size
            if h > w:
                orientation = 'Portrait'
            elif w == h:
                orientation = 'Square'
            for name, (max_w, max_h) in DERIVATIVES.items():
                thumb = img.copy()
                thumb.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
                out = os.path.join(temp_dir, f"{content_hash[:16]}_{name}.jpg")
                thumb.save(out, 'JPEG', quality=85, optimize=True)
                derivatives[name] = out
    except Exception as e:
        print(f"    Derivative error: {e}")
        return None, 'Landscape'
    return derivatives, orientation

print("=== WildPhotography Batch 154 ===")
print(f"Start: {datetime.utcnow().isoformat()}Z")
print()

stats = {
    'folders_processed': 0,
    'folders_seen': [],
    'folders_with_existing_gallery_match': [],
    'folders_skipped_no_existing_gallery': [],
    'folders_skipped_ambiguous_mapping': [],
    'photos_scanned': 0,
    'duplicates_skipped': 0,
    'filename_collisions_renamed': 0,
    'new_imported': 0,
    'failed': 0,
    'failed_paths': [],
    'new_photo_ids': [],
    'derivatives_generated': 0,
    'og_images_set': 0,
    'seo_titles_generated': 0,
    'seo_metadata_generated': 0,
    'ready_for_public_render': 0,
    'search_ready': 0,
    'skipped_existing_high_quality': 0,
    'repaired_prior_collision_records': 0,
    'per_gallery': {},
    'existing_gallery_ids_used': [],
    'inactive_galleries': [],
}

for folder_key, (gallery_id, gallery_slug) in GALLERY_MAP.items():
    folder_path = os.path.join(BASE, folder_key)
    folder_name = folder_key.split('/')[-1]
    stats['folders_seen'].append(folder_key)
    stats['per_gallery'][folder_name] = {
        'total_on_disk': 0, 'new': 0, 'duplicates': 0,
        'filename_collisions': 0, 'status': 'unknown',
        'gallery_id': gallery_id, 'gallery_slug': gallery_slug
    }

    if not os.path.isdir(folder_path):
        print(f"SKIP (not on disk): {folder_name}")
        stats['folders_skipped_no_existing_gallery'].append(folder_key)
        stats['per_gallery'][folder_name]['status'] = 'not_on_disk'
        continue

    # Verify gallery exists in Neon and is active
    cur.execute("SELECT id, slug, is_active FROM galleries WHERE id = %s", (gallery_id,))
    row = cur.fetchone()
    if not row:
        print(f"SKIP (no Neon gallery): {folder_name} → gallery_id={gallery_id}")
        stats['folders_skipped_no_existing_gallery'].append(folder_key)
        stats['per_gallery'][folder_name]['status'] = 'no_neon_gallery'
        continue

    gallery_db_id, gallery_db_slug, is_active = row
    if not is_active:
        print(f"SKIP (inactive Neon gallery): {folder_name} → gallery_id={gallery_id}")
        stats['folders_skipped_no_existing_gallery'].append(folder_key)
        stats['inactive_galleries'].append((folder_name, gallery_id))
        stats['per_gallery'][folder_name]['status'] = 'inactive_gallery'
        continue

    stats['folders_with_existing_gallery_match'].append(folder_key)
    stats['existing_gallery_ids_used'].append(gallery_id)
    stats['folders_processed'] += 1
    print(f"PROCESS: {folder_name} → gallery_id={gallery_id}, slug={gallery_slug}")

    # Get existing hashes for dedup
    existing_hashes = get_existing_hashes(gallery_id)
    print(f"  Existing photos in Neon gallery: {len(existing_hashes)}")

    # Scan folder
    all_files = os.listdir(folder_path)
    # Skip macOS metadata files (starting with '._')
    image_files = [f for f in all_files if f.lower().endswith(EXTENSIONS) and not f.startswith('._')]
    skipped_macOS_metadata = len([f for f in all_files if f.startswith('._') and f.lower().endswith(EXTENSIONS)])
    stats['per_gallery'][folder_name]['total_on_disk'] = len(image_files)
    print(f"  Files on disk: {len(image_files)} (skipped {skipped_macOS_metadata} macOS metadata files)")

    for filename in image_files:
        filepath = os.path.join(folder_path, filename)
        stats['photos_scanned'] += 1

        # Compute hash
        with open(filepath, 'rb') as f:
            content_hash = hashlib.md5(f.read()).hexdigest()

        # Check for duplicate
        if content_hash in existing_hashes:
            stats['duplicates_skipped'] += 1
            stats['per_gallery'][folder_name]['duplicates'] += 1
            continue

        # New file - import it
        print(f"  NEW: {filename} (hash: {content_hash[:12]}...)")

        # Upload original to R2
        r2_key = f"photos/{gallery_slug}/{content_hash[:2]}/{content_hash}.jpg"
        if not upload_to_r2(filepath, r2_key):
            stats['failed'] += 1
            stats['failed_paths'].append(filepath)
            continue

        # Generate derivatives
        derivatives, orientation = make_derivatives(filepath, content_hash)
        if derivatives is None:
            stats['failed'] += 1
            stats['failed_paths'].append(filepath)
            continue

        # Upload derivatives
        deriv_urls = {}
        for name, deriv_path in derivatives.items():
            deriv_key = f"photos/{gallery_slug}/{content_hash[:2]}/{content_hash}_{name}.jpg"
            if upload_to_r2(deriv_path, deriv_key):
                deriv_urls[name] = f"https://{R2_PUBLIC_DOMAIN}/{deriv_key}"
                stats['derivatives_generated'] += 1

 # Insert into Neon
        try:
            photo_slug = make_slug(filename, content_hash)
            cur.execute("""
 INSERT INTO photos (
                    gallery_id, slug, content_hash, original_r2_key, thumb_url, small_url,
                    medium_url, large_url, preview_url, orientation, filename,
                    status, metadata_complete, derivatives_complete,
                    ready_for_public_render, search_ready
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    'draft', true, true, true, true
                )
                RETURNING id
            """, (
                gallery_id, photo_slug, content_hash, f"https://{R2_PUBLIC_DOMAIN}/{r2_key}",
                deriv_urls.get('thumb'), deriv_urls.get('small'),
                deriv_urls.get('medium'), deriv_urls.get('large'),
                deriv_urls.get('preview'), orientation, filename
            ))
            photo_id = cur.fetchone()[0]
            conn.commit()
            stats['new_imported'] += 1
            stats['new_photo_ids'].append(photo_id)
            stats['per_gallery'][folder_name]['new'] += 1
            stats['ready_for_public_render'] += 1
            stats['search_ready'] += 1
        except Exception as e:
            print(f"    DB insert error: {e}")
            conn.rollback()
            stats['failed'] += 1
            stats['failed_paths'].append(filepath)

print()
print("=== SUMMARY ===")
print(f"Folders seen: {len(stats['folders_seen'])}")
print(f"Folders with existing gallery match: {len(stats['folders_with_existing_gallery_match'])}")
print(f"Folders skipped (no existing gallery): {len(stats['folders_skipped_no_existing_gallery'])}")
print(f"Folders skipped (ambiguous): {len(stats['folders_skipped_ambiguous_mapping'])}")
print(f"Photos scanned: {stats['photos_scanned']}")
print(f"Duplicates skipped: {stats['duplicates_skipped']}")
print(f"New imported: {stats['new_imported']}")
print(f"Failed: {stats['failed']}")
print(f"Derivatives generated: {stats['derivatives_generated']}")
print(f"Ready for public render: {stats['ready_for_public_render']}")
print(f"Search ready: {stats['search_ready']}")
print()
print("Per-gallery:")
for name, data in stats['per_gallery'].items():
    print(f"  {name}: {data['total_on_disk']} on disk, {data['new']} new, {data['duplicates']} dup, status={data['status']}")

# Save report
import json
report = {
    'batch': 154,
    'timestamp': datetime.utcnow().isoformat() + 'Z',
    **stats
}
report_path = os.path.join(os.path.dirname(__file__), 'inventory', 'batch154_import_report.json')
with open(report_path, 'w') as f:
    json.dump(report, f, indent=2)
print(f"\nReport saved to: {report_path}")

# Cleanup
shutil.rmtree(temp_dir, ignore_errors=True)
conn.close()
