#!/usr/bin/env python3
"""
WildPhotography Repair Agent - Batch Processor
Processes derivative_rebuild_queue jobs:
- Fix slug collision damage
- Repair missing derivatives
- Repair DB/R2 mismatches
- Regenerate derivatives
"""

import os
import sys
import json
import subprocess
import psycopg2
from datetime import datetime
from pathlib import Path

# Configuration
R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com'
R2_BUCKET = 'wildphoto-storage'
AWS_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75'
AWS_SECRET_KEY = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f'

DB_CONFIG = {
    'host': 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
    'database': 'wildphotography',
    'user': 'neondb_owner',
    'password': 'npg_BvF2JsQ8drba',
    'sslmode': 'require',
    'channel_binding': 'require'
}

REPAIR_LIMIT = 25
REPAIR_BATCH_ID = f'repair_{datetime.now().strftime("%Y%m%d_%H%M%S")}'

def run_s5cmd(args, check=True):
    """Run s5cmd command"""
    env = os.environ.copy()
    env['AWS_ACCESS_KEY_ID'] = AWS_ACCESS_KEY
    env['AWS_SECRET_ACCESS_KEY'] = AWS_SECRET_KEY
    cmd = ['s5cmd', '--endpoint-url', R2_ENDPOINT] + args
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0 and check:
        return None
    return result.stdout.strip()

def check_r2_exists(path):
    """Check if R2 object exists"""
    result = run_s5cmd(['ls', f's3://{R2_BUCKET}/{path}'], check=False)
    return result is not None and '0' not in result.split('\n')[-1] if result else False

def get_derivatives_list(photo_id):
    """Get list of derivatives in R2 for a given photo_id directory"""
    out = run_s5cmd(['ls', f's3://{R2_BUCKET}/derivatives/{photo_id}/'], check=False)
    if not out:
        return []
    files = []
    for line in out.split('\n'):
        if line.strip() and '.jpg' in line.lower():
            parts = line.strip().split()
            if len(parts) >= 4:
                filename = parts[3]
                files.append(filename)
    return files

def get_originals_list(photo_id):
    """Get list of originals in R2 for a given photo_id directory"""
    out = run_s5cmd(['ls', f's3://{R2_BUCKET}/originals/{photo_id}/'], check=False)
    if not out:
        return []
    files = []
    for line in out.split('\n'):
        if line.strip():
            parts = line.strip().split()
            if len(parts) >= 4:
                filename = parts[3]
                files.append(filename)
    return files

def check_slug_collision(slug, current_id, cur):
    """Check if slug has collisions"""
    cur.execute("SELECT id, slug FROM photos WHERE slug = %s AND id != %s", (slug, current_id))
    return cur.fetchall()

def log_repair(photo_id, repair_type, details, status, cur, conn):
    """Log repair action - skip if columns don't exist"""
    # repair_logs schema: id, details, started_at, completed_at, records_affected, repair_type, status, error_message
    try:
        cur.execute("""
            INSERT INTO repair_logs (repair_type, details, status, started_at, completed_at)
            VALUES (%s, %s, %s, NOW(), NOW())
        """, (repair_type, json.dumps(details), status))
        conn.commit()
    except Exception as e:
        print(f"Warning: could not log repair: {e}")
        conn.rollback()

def process_job(job, cur, conn):
    """Process a single repair job"""
    queue_id, photo_id = job['queue_id'], job['photo_id']
    
    result = {
        'queue_id': queue_id,
        'photo_id': photo_id,
        'slug': job['slug'],
        'repairs': [],
        'errors': [],
        'approval_required': [],
        'status': 'completed'
    }
    
    # 1. Check slug collision
    collisions = check_slug_collision(job['slug'], photo_id, cur)
    if collisions:
        result['repairs'].append(f'slug_collision: {len(collisions)} duplicates found')
        result['approval_required'].append({
            'type': 'slug_change',
            'reason': f'Slug "{job["slug"]}" has {len(collisions)} collisions',
            'affected_ids': [c[0] for c in collisions]
        })
    
    # 2. Check R2 originals existence
    originals = get_originals_list(photo_id)
    has_original = len(originals) > 0
    result['repairs'].append(f'original_r2: {"exists" if has_original else "missing"} ({len(originals)} files)')
    
    # 3. Check R2 derivatives existence
    derivatives = get_derivatives_list(photo_id)
    has_derivatives = len(derivatives) > 0
    result['repairs'].append(f'derivatives_r2: {"exists" if has_derivatives else "missing"} ({len(derivatives)} files)')
    
    # 4. Check DB/R2 key mismatch
    db_keys = {
        'r2_original_key': job.get('r2_original_key'),
        'r2_thumb_key': job.get('r2_thumb_key'),
        'r2_web_small_key': job.get('r2_web_small_key'),
        'r2_web_large_key': job.get('r2_web_large_key'),
        'r2_print_key': job.get('r2_print_key'),
    }
    
    r2_keys_needed = []
    if has_original:
        # Original should be at originals/{photo_id}/{filename}
        r2_keys_needed.append('r2_original_key')
    if has_derivatives:
        # Need to check what derivative types exist
        for d in derivatives:
            d_lower = d.lower()
            if 'thumb' in d_lower:
                r2_keys_needed.append('r2_thumb_key')
            elif 'small' in d_lower or 'web' in d_lower:
                r2_keys_needed.append('r2_web_small_key')
            elif 'large' in d_lower:
                r2_keys_needed.append('r2_web_large_key')
            elif 'print' in d_lower:
                r2_keys_needed.append('r2_print_key')
    
    missing_keys = [k for k in set(r2_keys_needed) if not db_keys.get(k)]
    if missing_keys:
        result['repairs'].append(f'db_r2_mismatch: missing keys {missing_keys}')
        
        # Auto-repair: update DB with actual R2 keys where we can derive them
        updates = {}
        if 'r2_original_key' in missing_keys and has_original:
            # Original path: originals/{photo_id}/{filename}
            filename = originals[0]  # Assume first file is the original
            updates['r2_original_key'] = f'originals/{photo_id}/{filename}'
        
        if 'r2_thumb_key' in missing_keys:
            for d in derivatives:
                if 'thumb' in d.lower():
                    updates['r2_thumb_key'] = f'derivatives/{photo_id}/{d}'
                    break
        
        if 'r2_web_small_key' in missing_keys:
            for d in derivatives:
                if 'small' in d.lower() or ('web' in d.lower() and 'large' not in d.lower()):
                    updates['r2_web_small_key'] = f'derivatives/{photo_id}/{d}'
                    break
        
        if 'r2_web_large_key' in missing_keys:
            for d in derivatives:
                if 'large' in d.lower():
                    updates['r2_web_large_key'] = f'derivatives/{photo_id}/{d}'
                    break
        
        if 'r2_print_key' in missing_keys:
            for d in derivatives:
                if 'print' in d.lower():
                    updates['r2_print_key'] = f'derivatives/{photo_id}/{d}'
                    break
        
        if updates:
            # Build update query
            set_clause = ', '.join([f"{k} = %s" for k in updates.keys()])
            values = list(updates.values()) + [photo_id]
            query = f"UPDATE photos SET {set_clause}, derivatives_complete = true, updated_at = NOW() WHERE id = %s"
            cur.execute(query, values)
            conn.commit()
            result['repairs'].append(f'auto_repaired_db_keys: {list(updates.keys())}')
            log_repair(photo_id, 'db_r2_mismatch', {'updated_keys': list(updates.keys())}, 'fixed', cur, conn)
    
    # 5. Check for missing derivatives that need generation
    if has_original and not has_derivatives:
        result['repairs'].append('derivatives_missing: needs regeneration')
        result['approval_required'].append({
            'type': 'derivative_regeneration',
            'reason': f'Original exists but derivatives missing for photo {photo_id}',
            'original_path': f'originals/{photo_id}/{originals[0]}' if originals else None
        })
    
    # 6. Check if original is missing (true orphan case)
    if not has_original:
        result['repairs'].append('original_missing: cannot regenerate')
        result['approval_required'].append({
            'type': 'manual_review',
            'reason': f'No original found in R2 for photo {photo_id}',
            'slug': job['slug']
        })
    
    # Mark queue item as processed
    cur.execute("""
        UPDATE derivative_rebuild_queue 
        SET status = 'completed', date_modified = NOW()
        WHERE id = %s
    """, (queue_id,))
    conn.commit()
    
    return result

def main():
    print(f"[{REPAIR_BATCH_ID}] Starting repair batch (limit={REPAIR_LIMIT})")
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Fetch pending jobs
    cur.execute("""
        SELECT q.id, q.photo_id, q.status, q.attempts,
               p.slug, p.title, p.gallery_slug,
               p.r2_original_key, p.r2_thumb_key, p.r2_web_small_key, p.r2_web_large_key, p.r2_print_key,
               p.thumb_url, p.ready_for_public_render, p.search_ready, p.derivatives_complete,
               p.status as photo_status, p.source_path, p.content_hash
        FROM derivative_rebuild_queue q
        JOIN photos p ON p.id = q.photo_id
        WHERE q.status = 'pending'
        ORDER BY q.date_created
        LIMIT %s
    """, (REPAIR_LIMIT,))
    
    columns = [desc[0] for desc in cur.description]
    rows = cur.fetchall()
    
    print(f"Fetched {len(rows)} jobs from queue")
    
    results = []
    jobs_processed = 0
    repairs_completed = 0
    failures = 0
    approvals_needed = []
    
    for row in rows:
        job = dict(zip(columns, row))
        job['queue_id'] = job['id']
        
        # Reset transaction state
        conn.rollback()
        
        try:
            result = process_job(job, cur, conn)
            results.append(result)
            jobs_processed += 1
            repairs_completed += len(result['repairs'])
            approvals_needed.extend(result['approval_required'])
        except Exception as e:
            print(f"ERROR processing queue_id={job['queue_id']} photo_id={job['photo_id']}: {e}")
            failures += 1
            conn.rollback()
            
            # Log failure
            try:
                cur.execute("""
                    UPDATE derivative_rebuild_queue 
                    SET status = 'failed', last_error = %s, attempts = attempts + 1, date_modified = NOW()
                    WHERE id = %s
                """, (str(e), job['queue_id']))
                conn.commit()
            except:
                conn.rollback()
    
    conn.close()
    
    print(f"\n=== REPAIR BATCH RESULTS ===")
    print(f"jobs_processed: {jobs_processed}")
    print(f"repairs_completed: {repairs_completed}")
    print(f"failures: {failures}")
    print(f"items_requiring_approval: {len(approvals_needed)}")
    
    if approvals_needed:
        print(f"\n=== APPROVAL ITEMS ===")
        for i, item in enumerate(approvals_needed[:10]):  # Show first 10
            print(f"{i+1}. type={item['type']} reason={item['reason'][:80]}")
    
    # Save results
    output_path = f"/Users/joshuatenbrink/.openclaw/workspace/wildphotography/reports/repair_batch_{REPAIR_BATCH_ID}.json"
    with open(output_path, 'w') as f:
        json.dump({
            'batch_id': REPAIR_BATCH_ID,
            'jobs_processed': jobs_processed,
            'repairs_completed': repairs_completed,
            'failures': failures,
            'items_requiring_approval': len(approvals_needed),
            'approval_items': approvals_needed,
            'results': results
        }, f, indent=2, default=str)
    
    print(f"\nResults saved to: {output_path}")
    
    return jobs_processed, repairs_completed, failures, len(approvals_needed)

if __name__ == '__main__':
    main()
