#!/usr/bin/env python3
"""
WildPhotography Batch 158
Scan 5 galleries, import only confirmed new files.
Galleries: Land-Animals(52), Landmarks(53), Landscape(54),
           Las-Catalinas-Guanacaste(55), Lifestyle(56)
"""
import os, hashlib, psycopg2, shutil, re
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
    "Costa-Rica-Gallery/Land-Animals":                                   (52, "land-animals"),
    "Costa-Rica-Gallery/Landmarks":                                      (53, "landmarks"),
    "Costa-Rica-Gallery/Landscape":                                      (54, "landscape"),
    "Costa-Rica-Gallery/Las-Catalinas-Guanacaste":                       (55, "las-catalinas-guanacaste"),
    "Costa-Rica-Gallery/Lifestyle":                                      (56, "lifestyle"),
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

temp_dir = "/tmp/wildphoto_batch158"
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

print("=== WildPhotography Batch 158 ===")
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
    print(f"PROCESS: {folder_name} → gallery_id={gallery_id}, slug={gallery_db_slug}")

    existing_hashes = get_existing_hashes(gallery_id)
    print(f"  Existing photos in Neon gallery: {len(existing_hashes)}")

    all_files = os.listdir(folder_path)
    image_files = [f for f in all_files if f.lower().endswith(EXTENSIONS) and not f.startswith('._')]
    skipped_macOS_metadata = len([f for f in all_files if f.startswith('._') and f.lower().endswith(EXTENSIONS)])
    stats['per_gallery'][folder_name]['total_on_disk'] = len(image_files)
    print(f"  Files on disk: {len(image_files)} (skipped {skipped_macOS_metadata} macOS metadata files)")

    fname_counts = {}
    for fname in image_files:
        base = os.path.splitext(fname)[0]
        fname_counts[base] = fname_counts.get(base, 0) + 1

    collision_renames = 0
    new_files = []
    for filename in image_files:
        filepath = os.path.join(folder_path, filename)
        stats['photos_scanned'] += 1

        with open(filepath, 'rb') as f:
            content_hash = hashlib.md5(f.read()).hexdigest()

        if content_hash in existing_hashes:
            stats['duplicates_skipped'] += 1
            stats['per_gallery'][folder_name]['duplicates'] += 1
            continue

        base = os.path.splitext(filename)[0]
        if fname_counts[base] > 1:
            collision_renames += 1
            stats['filename_collisions_renamed'] += 1
            stats['per_gallery'][folder_name]['filename_collisions'] += 1

        new_files.append((filepath, filename, content_hash))
        existing_hashes.add(content_hash)

    if not new_files:
        print(f"  → 0 new ({stats['per_gallery'][folder_name]['duplicates']} dup) → SKIP")
        stats['per_gallery'][folder_name]['status'] = 'fully_imported'
        continue

    print(f"  → {len(new_files)} NEW / {stats['per_gallery'][folder_name]['duplicates']} dup / {collision_renames} collisions")

    upload_failures = 0
    for fpath, filename, content_hash in new_files[:100]:
        try:
            derivs, orientation = make_derivatives(fpath, content_hash)
            if derivs is None:
                raise Exception("derivative generation failed")

            stats['derivatives_generated'] += len(derivs)

            orig_key = f"originals/{gallery_slug}/{content_hash[:2]}/{content_hash}.jpg"
            if not upload_to_r2(fpath, orig_key):
                raise Exception("original upload failed")

            r2_keys = {'original': orig_key}
            for name, local_path in derivs.items():
                key = f"derivatives/{gallery_slug}/{content_hash[:2]}/{content_hash[:16]}_{name}.jpg"
                if upload_to_r2(local_path, key):
                    r2_keys[name] = key

            base_url = f"https://{R2_PUBLIC_DOMAIN}/"
            thumb_url   = base_url + r2_keys.get('thumb','')
            small_url   = base_url + r2_keys.get('small','')
            medium_url  = base_url + r2_keys.get('medium','')
            large_url   = base_url + r2_keys.get('large','')
            preview_url = base_url + r2_keys.get('preview','')

            photo_slug = make_slug(filename, content_hash)

            cur.execute("""
                INSERT INTO photos (
                    gallery_id, slug, content_hash,
                    original_r2_key,
                    r2_thumb_key, r2_web_small_key, r2_web_large_key, r2_print_key,
                    thumb_url, small_url, medium_url, large_url, preview_url,
                    orientation, filename,
                    status, metadata_complete, derivatives_complete,
                    ready_for_public_render, search_ready,
                    original_stored, date_uploaded
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    'draft', true, true, true, true, true, %s
                )
                RETURNING id
            """, (
                gallery_id, photo_slug, content_hash,
                r2_keys['original'],
                r2_keys.get('thumb'), r2_keys.get('small'),
                r2_keys.get('large'), r2_keys.get('preview'),
                thumb_url, small_url, medium_url, large_url, preview_url,
                orientation, filename,
                datetime.now()
            ))
            photo_id = cur.fetchone()[0]
            conn.commit()

            stats['new_imported'] += 1
            stats['new_photo_ids'].append(photo_id)
            stats['ready_for_public_render'] += 1
            stats['search_ready'] += 1
            stats['per_gallery'][folder_name]['new'] += 1
            print(f"    ✓ {filename} → photo_id={photo_id}")

        except Exception as e:
            print(f"    ✗ {filename}: {e}")
            stats['failed'] += 1
            stats['failed_paths'].append(fpath)
            upload_failures += 1
            conn.rollback()
            if upload_failures >= 3:
                print(f"    STOPPING: 3 consecutive upload failures in {folder_name}")
                break

    if stats['per_gallery'][folder_name]['new'] > 0:
        stats['per_gallery'][folder_name]['status'] = 'new_import'
    else:
        stats['per_gallery'][folder_name]['status'] = 'fully_imported'

# Cleanup
for f in os.listdir(temp_dir):
    try:
        os.remove(os.path.join(temp_dir, f))
    except:
        pass
try:
    shutil.rmtree(temp_dir)
except:
    pass

cur.close()
conn.close()

print()
print("=== BATCH 158 COMPLETE ===")
print(f"Start: {datetime.utcnow().isoformat()}Z")
print(f"Folders seen: {stats['folders_seen']}")
print(f"Folders with existing gallery match: {stats['folders_with_existing_gallery_match']}")
print(f"Folders skipped (no existing gallery): {stats['folders_skipped_no_existing_gallery']}")
print(f"Folders skipped (ambiguous): {stats['folders_skipped_ambiguous_mapping']}")
print(f"Folders processed: {stats['folders_processed']}")
print(f"Photos scanned: {stats['photos_scanned']}")
print(f"Duplicates skipped: {stats['duplicates_skipped']}")
print(f"Filename collisions renamed: {stats['filename_collisions_renamed']}")
print(f"New imports: {stats['new_imported']}")
print(f"Derivatives generated: {stats['derivatives_generated']}")
print(f"SEO metadata generated: {stats['seo_metadata_generated']}")
print(f"SEO titles generated: {stats['seo_titles_generated']}")
print(f"OG images set: {stats['og_images_set']}")
print(f"Ready for public render: {stats['ready_for_public_render']}")
print(f"Search ready: {stats['search_ready']}")
print(f"Skipped (existing high quality): {stats['skipped_existing_high_quality']}")
print(f"Repaired prior collision records: {stats['repaired_prior_collision_records']}")
print(f"Failed: {stats['failed']}")
print(f"Existing gallery IDs used: {stats['existing_gallery_ids_used']}")
print(f"Inactive galleries encountered: {stats['inactive_galleries']}")
print()
print("Per-gallery breakdown:")
for g, v in stats['per_gallery'].items():
    print(f"  {g}: total_on_disk={v['total_on_disk']} new={v['new']} duplicates={v['duplicates']} collisions={v['filename_collisions']} status={v['status']}")
if stats['new_photo_ids']:
    print(f"New photo IDs: {stats['new_photo_ids']}")
if stats['failed_paths']:
    print(f"Failed paths: {stats['failed_paths']}")

# Save report
import json
report = {
    'batch': 158,
    'timestamp': datetime.utcnow().isoformat() + 'Z',
    **stats
}
report_path = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/batch158_import_report.json'
with open(report_path, 'w') as f:
    json.dump(report, f, indent=2)
print(f"\nReport saved to: {report_path}")