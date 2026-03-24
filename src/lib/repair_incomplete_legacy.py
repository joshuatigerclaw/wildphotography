#!/usr/bin/env python3
"""
WildPhotography Repair Incomplete Legacy Photos
Repairs photos that are not ready_for_public_render (excluding legacy_static).
"""

import json
import logging
import os
import sys
import tempfile
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID = "b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_ACCESS_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"
R2_ENDPOINT = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
BUCKET = "wildphoto-storage"
R2_PUBLIC_HOST = "https://images.wildphotography.com"
DB_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# Derivative config: (db_col, r2_folder, width, quality)
DERIVATIVES = [
    ('thumb_url',    'thumb',    400, 80),
    ('small_url',    'small',    900, 85),
    ('medium_url',   'medium',  1600, 88),
    ('large_url',    'large',  2400, 90),
    ('preview_url',  'web',     1600, 88),
]

# ── Helpers ──────────────────────────────────────────────────────────────────
def run_cmd(cmd):
    import subprocess
    env = {**os.environ, 'AWS_ACCESS_KEY_ID': AWS_ACCESS_KEY_ID, 'AWS_SECRET_ACCESS_KEY': AWS_SECRET_ACCESS_KEY}
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, env=env)
    return r.stdout.strip(), r.stderr.strip(), r.returncode

def r2_exists(key):
    cmd = f's5cmd --endpoint-url {R2_ENDPOINT} ls s3://{BUCKET}/{key}'
    _, _, code = run_cmd(cmd)
    return code == 0

def r2_upload(local_path, key):
    cmd = f's5cmd --endpoint-url {R2_ENDPOINT} cp "{local_path}" "s3://{BUCKET}/{key}"'
    _, stderr, code = run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"Upload failed: {stderr[:200]}")
    return f"{R2_PUBLIC_HOST}/{key}"

def r2_download(key, local_path):
    cmd = f's5cmd --endpoint-url {R2_ENDPOINT} cp "s3://{BUCKET}/{key}" "{local_path}"'
    _, stderr, code = run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"Download failed: {stderr[:200]}")

def generate_derivative(input_path, width, quality):
    output_fd, output_path = tempfile.mkstemp(suffix='.jpg')
    os.close(output_fd)
    cmd = ['/opt/homebrew/bin/magick', input_path, '-quality', str(quality), '-resize', f'{width}>', '-strip', output_path]
    import subprocess
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Magick failed: {r.stderr[:100]}")
    return output_path

def r2_key_to_url(key):
    if not key:
        return ''
    return f"{R2_PUBLIC_HOST}/{key}"

# ── Build R2 derivative key ──────────────────────────────────────────────────
def build_deriv_key(original_key, folder):
    """Build derivative key from original key and folder name."""
    # originals/{gallery}/{filename}.jpg  →  derivatives/{folder}/{filename}.jpg
    if not original_key:
        return None
    filename = original_key.split('/')[-1]
    name_part = filename.rsplit('.', 1)[0] if '.' in filename else filename
    ext = '.' + filename.rsplit('.', 1)[1] if '.' in filename else '.jpg'
    return f"derivatives/{folder}/{name_part}{ext}"

# ── DB ────────────────────────────────────────────────────────────────────────
import psycopg2
from psycopg2.extras import RealDictCursor

def db_connect():
    return psycopg2.connect(DB_CONN)

def load_incomplete(max_records):
    conn = db_connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, slug, source_path, original_r2_key, content_hash,
               thumb_url, small_url, medium_url, large_url, preview_url,
               title, keywords, metadata, record_origin
        FROM photos
        WHERE ready_for_public_render = false
          AND COALESCE(record_origin, '') <> 'legacy_static'
        LIMIT %s
    """, (max_records,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]

def mark_render_ready(photo_id):
    conn = db_connect()
    cur = conn.cursor()
    cur.execute("""
        UPDATE photos
        SET ready_for_public_render = true, derivatives_complete = true
        WHERE id = %s
    """, (photo_id,))
    conn.commit()
    cur.close()
    conn.close()

def mark_search_ready(photo_id):
    conn = db_connect()
    cur = conn.cursor()
    cur.execute("""
        UPDATE photos
        SET search_ready = true
        WHERE id = %s
          AND title IS NOT NULL AND LENGTH(TRIM(title)) > 0
          AND keywords IS NOT NULL AND LENGTH(TRIM(keywords)) > 0
    """, (photo_id,))
    conn.commit()
    cur.close()
    conn.close()

def update_derivative_urls(photo_id, deriv_urls):
    """Update derivative URLs in DB."""
    if not deriv_urls:
        return
    sets = []
    vals = []
    for col, url in deriv_urls.items():
        if url:
            sets.append(f"{col} = %s")
            vals.append(url)
    if not sets:
        return
    vals.append(photo_id)
    conn = db_connect()
    cur = conn.cursor()
    cur.execute(f"UPDATE photos SET {', '.join(sets)} WHERE id = %s", vals)
    conn.commit()
    cur.close()
    conn.close()

# ── Main ─────────────────────────────────────────────────────────────────────
def run(max_records=500):
    logger.info("=== WildPhotography Repair Incomplete Legacy ===")
    
    rows = load_incomplete(max_records)
    scanned = len(rows)
    logger.info(f"Loaded {scanned} incomplete records (excl. legacy_static)")
    
    originals_restored = 0
    derivatives_generated = 0
    repaired_render = 0
    repaired_search = 0
    enqueued_meta = 0
    unresolved = []
    
    for row in rows:
        pid = row['id']
        slug = row['slug']
        orig_key = row.get('original_r2_key') or ''
        source_path = row.get('source_path') or ''
        existing_urls = {
            'thumb_url': row.get('thumb_url') or '',
            'small_url': row.get('small_url') or '',
            'medium_url': row.get('medium_url') or '',
            'large_url': row.get('large_url') or '',
            'preview_url': row.get('preview_url') or '',
        }
        
        try:
            # ── Step 1: Check / restore original in R2 ─────────────────────
            if orig_key and not r2_exists(orig_key):
                # Try local source
                if source_path and Path(source_path).exists():
                    r2_upload(source_path, orig_key)
                    originals_restored += 1
                    logger.info(f"  Restored original [{pid}]: {orig_key}")
                else:
                    logger.warning(f"  No local source for [{pid}]: {orig_key}")
            
            # ── Step 2: Generate missing derivatives ───────────────────────
            deriv_urls = {}
            missing_derivs = []
            
            for db_col, folder, width, quality in DERIVATIVES:
                if existing_urls.get(db_col):
                    deriv_urls[db_col] = existing_urls[db_col]
                    continue  # already exists
                
                if not orig_key:
                    continue
                
                deriv_key = build_deriv_key(orig_key, folder)
                if not deriv_key or r2_exists(deriv_key):
                    # Already exists in R2, populate URL
                    if deriv_key:
                        deriv_urls[db_col] = r2_key_to_url(deriv_key)
                    continue
                
                # Need to generate
                missing_derivs.append((db_col, folder, width, quality, deriv_key))
            
            # Download original from R2 (if exists now) and generate
            if missing_derivs and orig_key and r2_exists(orig_key):
                tmp_fd, tmp_orig = tempfile.mkstemp(suffix='.jpg')
                os.close(tmp_fd)
                try:
                    r2_download(orig_key, tmp_orig)
                    
                    for db_col, folder, width, quality, deriv_key in missing_derivs:
                        try:
                            deriv_path = generate_derivative(tmp_orig, width, quality)
                            r2_upload(deriv_path, deriv_key)
                            deriv_urls[db_col] = r2_key_to_url(deriv_key)
                            derivatives_generated += 1
                            logger.info(f"  Generated {db_col} [{pid}]: {deriv_key}")
                            os.unlink(deriv_path)
                        except Exception as e:
                            logger.error(f"  Derivative gen failed {db_col} [{pid}]: {e}")
                finally:
                    if os.path.exists(tmp_orig):
                        os.unlink(tmp_orig)
            
            # ── Step 3: Update derivative URLs ───────────────────────────────
            if deriv_urls:
                update_derivative_urls(pid, deriv_urls)
            
            # ── Step 4: Mark ready ─────────────────────────────────────────
            # Is render-ready if original in R2 AND at least thumb_url exists
            has_original = bool(orig_key and r2_exists(orig_key))
            has_thumb = bool(deriv_urls.get('thumb_url') or existing_urls.get('thumb_url'))
            
            if has_original and has_thumb:
                mark_render_ready(pid)
                repaired_render += 1
                logger.info(f"  Marked ready_for_public_render [{pid}]")
                
                # Metadata check for search_ready
                title = row.get('title')
                keywords = row.get('keywords')
                if title and str(title).strip() and keywords and str(keywords).strip():
                    mark_search_ready(pid)
                    repaired_search += 1
                    logger.info(f"  Marked search_ready [{pid}]")
                else:
                    enqueued_meta += 1
                    logger.info(f"  Enqueued for metadata enrichment [{pid}]")
            else:
                unresolved.append({
                    'id': pid, 'slug': slug,
                    'has_original': has_original,
                    'has_thumb': has_thumb,
                    'missing_derivs': len(missing_derivs)
                })
                
        except Exception as e:
            logger.error(f"Error [{pid}]: {e}")
            unresolved.append({'id': pid, 'slug': slug, 'error': str(e)})
    
    logger.info("=== SUMMARY ===")
    logger.info(f"  scanned:                    {scanned}")
    logger.info(f"  originals_restored:         {originals_restored}")
    logger.info(f"  derivatives_generated:      {derivatives_generated}")
    logger.info(f"  repaired_ready_for_render:  {repaired_render}")
    logger.info(f"  repaired_search_ready:      {repaired_search}")
    logger.info(f"  metadata_enqueued:          {enqueued_meta}")
    logger.info(f"  unresolved_count:            {len(unresolved)}")
    if unresolved[:5]:
        logger.info(f"  Sample unresolved IDs: {[u['id'] for u in unresolved[:5]]}")
    
    return {
        'scanned_count': scanned,
        'originals_restored': originals_restored,
        'derivatives_generated': derivatives_generated,
        'repaired_ready_for_render': repaired_render,
        'repaired_search_ready': repaired_search,
        'metadata_enqueued': enqueued_meta,
        'unresolved_count': len(unresolved),
        'unresolved': unresolved[:50],
    }


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--max_records', type=int, default=500)
    args = parser.parse_args()
    result = run(max_records=args.max_records)
    print(json.dumps(result, indent=2, default=str))
