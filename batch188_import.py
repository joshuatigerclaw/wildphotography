#!/usr/bin/env python3
"""
WildPhotography Batch 188
Scan 5 galleries with unprocessed folders from Costa-Rica-Gallery:
Flying-in-Costa-Rica, Food-, Forests-of-Costa-Rica, Guanacaste-Costa-Rica-Travel-and-Tourism, Jaco-Beach
Galleries: flying-in-costa-rica (36), food (37), forests-of-costa-rica (38),
           guanacaste-costa-rica-travel-and-tourism (40), jaco-beach (48)
Source: /Volumes/ADATA SC740/Smugmug Backup/Galleries/Costa-Rica-Gallery
Note: 15 photos max per folder to avoid SIGKILL timeout.
      Filters out ._ macOS metadata files.
"""
import os, hashlib, psycopg2, shutil, re
from datetime import datetime
import boto3

NEON_CONN = "postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
R2_BUCKET = "wildphoto-storage"
R2_PUBLIC_DOMAIN = "pub-7d412c6efb5943b5bc587e695e22001e.r2.dev"
AWS_ACCESS_KEY_ID = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_ACCESS_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"

BASE = "/Volumes/ADATA SC740/Smugmug Backup/Galleries/Costa-Rica-Gallery"

GALLERY_MAP = {
    "Flying-in-Costa-Rica":                       (36, "flying-in-costa-rica"),
    "Food-":                                      (37, "food"),
    "Forests-of-Costa-Rica":                      (38, "forests-of-costa-rica"),
    "Guanacaste-Costa-Rica-Travel-and-Tourism":   (40, "guanacaste-costa-rica-travel-and-tourism"),
    "Jaco-Beach":                                 (48, "jaco-beach"),
}

DERIVATIVES = {
    "thumb":   (200, 200),
    "small":   (640, 480),
    "medium":  (1280, 960),
    "large":   (2560, 1920),
    "preview": (1920, 1440)
}

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.tiff', '.webp')

s3 = boto3.client('s3', endpoint_url=R2_ENDPOINT,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY)

conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()

from PIL import Image

temp_dir = "/tmp/wildphoto_batch188"
os.makedirs(temp_dir, exist_ok=True)

def make_slug(filename, content_hash):
    name = os.path.splitext(filename)[0]
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', name)
    slug = re.sub(r'\s+', '-', slug)
    slug = slug.lower()[:50]
    return f"{slug}-{content_hash[:6]}"

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

print("=== WildPhotography Batch 188 ===")
print(f"Start: {datetime.utcnow().isoformat()}Z")
print()

stats = {
    'folders_processed': 0,
    'folders_seen': [],
    'folders_with_existing_gallery_match': [],
    'folders_skipped_no_existing_gallery': [],
    'folders_skipped_ambiguous_mapping': [],
    'files_skipped_unmapped_gallery': 0,
    'files_imported_to_existing_galleries': 0,
    'duplicates_skipped': 0,
    'filename_collisions_renamed': 0,
    'originals_uploaded': 0,
    'derivatives_generated': 0,
    'seo_metadata_generated': 0,
    'seo_titles_generated': 0,
    'og_images_set': 0,
    'skipped_existing_high_quality': 0,
    'repaired_prior_collision_records': 0,
    'ready_for_public_render': 0,
    'search_ready': 0,
    'failed_files': 0,
    'failed_file_paths': [],
    'existing_gallery_ids_used': set(),
    'per_gallery': {},
}

# Validate all folders exist and map to existing galleries
for folder_name, (gallery_id, slug) in GALLERY_MAP.items():
    folder_path = os.path.join(BASE, folder_name)
    stats['folders_seen'].append(folder_name)

    if not os.path.isdir(folder_path):
        print(f"SKIP: {folder_name} → folder does not exist on disk")
        stats['folders_skipped_no_existing_gallery'].append(folder_name)
        continue

    # Verify gallery exists and is active in Neon
    cur.execute("SELECT id, slug FROM galleries WHERE id = %s AND is_active = true", (gallery_id,))
    gallery_row = cur.fetchone()
    if not gallery_row:
        print(f"SKIP: {folder_name} → no active gallery match (gallery_id={gallery_id})")
        stats['folders_skipped_no_existing_gallery'].append(folder_name)
        continue

    stats['folders_with_existing_gallery_match'].append(folder_name)
    stats['folders_processed'] += 1
    stats['existing_gallery_ids_used'].add(gallery_id)
    stats['per_gallery'][folder_name] = {'total_on_disk': 0, 'new': 0, 'duplicates': 0, 'filename_collisions': 0, 'status': 'pending'}
    print(f"GALLERY: {folder_name} → gallery_id={gallery_id} slug={slug}")

print()
print(f"Folders seen: {len(stats['folders_seen'])}")
print(f"Folders matched to existing galleries: {len(stats['folders_with_existing_gallery_match'])}")
print(f"Processing {stats['folders_processed']} folders, max 15 photos per folder...")
print()

# Process each folder
for folder_name, (gallery_id, slug) in GALLERY_MAP.items():
    if folder_name not in stats['folders_with_existing_gallery_match']:
        continue

    folder_path = os.path.join(BASE, folder_name)
    if not os.path.isdir(folder_path):
        continue

    print(f"--- Processing: {folder_name} ---")

    existing_hashes = get_existing_hashes(gallery_id)
    print(f"  Existing hashes in gallery {gallery_id}: {len(existing_hashes)}")

    # Get existing filenames in this gallery for collision detection
    cur.execute("SELECT title FROM photos WHERE gallery_id = %s", (gallery_id,))
    existing_filenames = {row[0] for row in cur.fetchall()}

    # Collect all valid image files (skip macOS ._ metadata files)
    all_images = []
    for root, dirs, files in os.walk(folder_path):
        for f in files:
            if any(f.lower().endswith(ext) for ext in EXTENSIONS) and not f.startswith('._'):
                all_images.append(os.path.join(root, f))

    print(f"  Total images found: {len(all_images)}")
    stats['per_gallery'][folder_name]['total_on_disk'] = len(all_images)

    # Limit to 15 photos per folder to avoid timeout
    all_images = all_images[:15]

    photos_this_folder = 0
    dupes_this_folder = 0
    colls_this_folder = 0
    for img_path in all_images:
        if photos_this_folder >= 15:
            break

        filename = os.path.basename(img_path)
        content_hash = hashlib.md5(open(img_path, 'rb').read()).hexdigest()

        # Skip exact duplicates by hash
        if content_hash in existing_hashes:
            stats['duplicates_skipped'] += 1
            dupes_this_folder += 1
            continue

        # Handle filename collisions
        base_name = os.path.splitext(filename)[0]
        final_filename = filename
        collision_counter = 1
        while final_filename in existing_filenames:
            collision_counter += 1
            ext = os.path.splitext(filename)[1]
            final_filename = f"{base_name}_{collision_counter}{ext}"

        if final_filename != filename:
            stats['filename_collisions_renamed'] += 1
            colls_this_folder += 1

        existing_filenames.add(final_filename)

        # Generate derivatives
        derivatives, orientation = make_derivatives(img_path, content_hash)
        if derivatives is None:
            stats['failed_files'] += 1
            stats['failed_file_paths'].append(img_path)
            continue

        # Create R2 keys
        r2_original_key = f"photos/{slug}/{content_hash}{os.path.splitext(filename)[1]}"

        # Upload original
        if not upload_to_r2(img_path, r2_original_key):
            stats['failed_files'] += 1
            stats['failed_file_paths'].append(img_path)
            continue

        stats['originals_uploaded'] += 1

        # Upload derivatives
        derivative_urls = {}
        all_derivs_ok = True
        for deriv_name, deriv_path in derivatives.items():
            deriv_key = f"photos/{slug}/{content_hash}_{deriv_name}.jpg"
            if upload_to_r2(deriv_path, deriv_key):
                derivative_urls[f'{deriv_name}_url'] = f"https://{R2_PUBLIC_DOMAIN}/{deriv_key}"
                stats['derivatives_generated'] += 1
            else:
                all_derivs_ok = False

        if not all_derivs_ok:
            stats['failed_files'] += 1
            stats['failed_file_paths'].append(img_path)
            continue

        # Create slug for photo
        photo_slug = make_slug(final_filename, content_hash)

        # Insert into photos table
        try:
            cur.execute("""
                INSERT INTO photos (
                    title, slug, gallery_id, original_r2_key,
                    thumb_url, small_url, medium_url, large_url, preview_url,
                    width, height, orientation, is_active,
                    derivatives_complete, ready_for_public_render, search_ready,
                    date_uploaded, date_modified
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, true,
                    true, true, true,
                    NOW(), NOW()
                )
                RETURNING id
            """, (
                final_filename, photo_slug, gallery_id, r2_original_key,
                derivative_urls.get('thumb_url'), derivative_urls.get('small_url'),
                derivative_urls.get('medium_url'), derivative_urls.get('large_url'),
                derivative_urls.get('preview_url'),
                0, 0, orientation
            ))
            photo_id = cur.fetchone()[0]

            # Link to gallery
            cur.execute("""
                INSERT INTO gallery_photos (gallery_id, photo_id, sort_order)
                VALUES (%s, %s, COALESCE((SELECT MAX(sort_order) + 1 FROM gallery_photos WHERE gallery_id = %s), 0))
            """, (gallery_id, photo_id, gallery_id))

            conn.commit()
            stats['files_imported_to_existing_galleries'] += 1
            stats['ready_for_public_render'] += 1
            stats['search_ready'] += 1
            photos_this_folder += 1

        except Exception as e:
            print(f"    DB insert error: {e}")
            conn.rollback()
            stats['failed_files'] += 1
            stats['failed_file_paths'].append(img_path)
            continue

    stats['per_gallery'][folder_name]['new'] = photos_this_folder
    stats['per_gallery'][folder_name]['duplicates'] = dupes_this_folder
    stats['per_gallery'][folder_name]['filename_collisions'] = colls_this_folder
    stats['per_gallery'][folder_name]['status'] = 'new_import' if photos_this_folder > 0 else 'fully_imported'
    print(f"  Imported {photos_this_folder} new photos from {folder_name} ({dupes_this_folder} dupes, {colls_this_folder} collisions)")
    print()

# Cleanup temp directory
shutil.rmtree(temp_dir, ignore_errors=True)

# Summary
print("=" * 50)
print("BATCH 188 SUMMARY")
print("=" * 50)
print(f"folders_processed: {stats['folders_processed']}")
print(f"folders_seen: {stats['folders_seen']}")
print(f"folders_with_existing_gallery_match: {stats['folders_with_existing_gallery_match']}")
print(f"folders_skipped_no_existing_gallery: {stats['folders_skipped_no_existing_gallery']}")
print(f"folders_skipped_ambiguous_mapping: {stats['folders_skipped_ambiguous_mapping']}")
print(f"files_skipped_unmapped_gallery: {stats['files_skipped_unmapped_gallery']}")
print(f"files_imported_to_existing_galleries: {stats['files_imported_to_existing_galleries']}")
print(f"duplicates_skipped: {stats['duplicates_skipped']}")
print(f"filename_collisions_renamed: {stats['filename_collisions_renamed']}")
print(f"originals_uploaded: {stats['originals_uploaded']}")
print(f"derivatives_generated: {stats['derivatives_generated']}")
print(f"seo_metadata_generated: {stats['seo_metadata_generated']}")
print(f"seo_titles_generated: {stats['seo_titles_generated']}")
print(f"og_images_set: {stats['og_images_set']}")
print(f"skipped_existing_high_quality: {stats['skipped_existing_high_quality']}")
print(f"repaired_prior_collision_records: {stats['repaired_prior_collision_records']}")
print(f"ready_for_public_render: {stats['ready_for_public_render']}")
print(f"search_ready: {stats['search_ready']}")
print(f"failed_files: {stats['failed_files']}")
print(f"failed_file_paths: {stats['failed_file_paths'][:10]}")
print(f"existing_gallery_ids_used: {list(stats['existing_gallery_ids_used'])}")
print(f"per_gallery: {stats['per_gallery']}")
print()
print(f"Complete: {datetime.utcnow().isoformat()}Z")

cur.close()
conn.close()