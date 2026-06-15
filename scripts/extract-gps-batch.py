#!/usr/bin/env python3
"""
GPS Extraction Batch Script
Downloads originals from R2, extracts GPS via exiftool, updates Neon DB
Uses Python for reliable DMS parsing
"""

import subprocess
import re
import os
import sys
import psycopg2

R2_BUCKET = 'wildphoto-storage'
R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com'
R2_PROFILE = 'wildphoto'
TEMP_DIR = '/tmp/gps_extract'
DB_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

def parse_dms(dms):
    """Parse exiftool DMS format to decimal degrees"""
    if not dms:
        return None, None
    # Extract numbers and direction
    nums = re.findall(r'[\d.]+', dms)
    direction_chars = re.findall(r'[NSEW]', dms)
    if len(nums) >= 3 and direction_chars:
        direction = direction_chars[0]
        deg = float(nums[0])
        min_s = float(nums[1])
        sec = float(nums[2])
        decimal = deg + min_s/60 + sec/3600
        if direction in ('S', 'W'):
            decimal = -decimal
        return decimal, direction
    return None, None

def extract_gps(file_path):
    """Extract GPS coordinates from image file"""
    try:
        lat_raw = subprocess.check_output(
            ['exiftool', '-s', '-s', '-s', '-GPSLatitude', file_path],
            text=True, stderr=subprocess.DEVNULL
        ).strip()
        lon_raw = subprocess.check_output(
            ['exiftool', '-s', '-s', '-s', '-GPSLongitude', file_path],
            text=True, stderr=subprocess.DEVNULL
        ).strip()
        
        lat, lat_dir = parse_dms(lat_raw)
        lon, lon_dir = parse_dms(lon_raw)
        
        if lat is None or lon is None:
            return None, None
        return lat, lon
    except Exception:
        return None, None

def download_from_r2(r2_key, local_path):
    """Download file from R2"""
    try:
        result = subprocess.run(
            ['aws', 's3', 'cp', f's3://{R2_BUCKET}/{r2_key}', local_path,
             '--profile', R2_PROFILE, '--endpoint', R2_ENDPOINT],
            capture_output=True, timeout=60
        )
        return result.returncode == 0
    except Exception:
        return False

def update_db(photo_id, lat, lon):
    """Update database with GPS coordinates"""
    if lat is None or lon is None:
        return False
    try:
        conn = psycopg2.connect(DB_CONN)
        cur = conn.cursor()
        cur.execute(
            "UPDATE photos SET latitude = %s, longitude = %s, lat = %s, lon = %s WHERE id = %s",
            (lat, lon, lat, lon, photo_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f'  DB error: {e}', file=sys.stderr)
        return False

def get_photo_batch(limit=25):
    """Get batch of photos without GPS"""
    try:
        conn = psycopg2.connect(DB_CONN)
        cur = conn.cursor()
        cur.execute(
            "SELECT id, original_r2_key FROM photos WHERE latitude IS NULL AND original_r2_key IS NOT NULL AND original_r2_key != '' AND original_r2_key != ' ' LIMIT %s",
            (limit,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception:
        return []

def process_batch(batch_size=25):
    """Process a batch of photos"""
    print(f'Batch size: {batch_size}')
    photos = get_photo_batch(batch_size)
    if not photos:
        print('No photos to process')
        return 0, 0, 0
    
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    success = 0
    no_gps = 0
    failed = 0
    
    for photo_id, r2_key in photos:
        local_path = os.path.join(TEMP_DIR, f'photo_{photo_id}_{os.path.basename(r2_key)}')
        
        print(f'Photo {photo_id}... ', end='', flush=True)
        
        if not download_from_r2(r2_key, local_path):
            print('download_failed')
            failed += 1
            continue
        
        lat, lon = extract_gps(local_path)
        
        try:
            os.unlink(local_path)
        except Exception:
            pass
        
        if lat is None or lon is None:
            print('no GPS')
            no_gps += 1
            continue
        
        if update_db(photo_id, lat, lon):
            print(f'OK ({lat:.4f}, {lon:.4f})')
            success += 1
        else:
            print('db_failed')
            failed += 1
    
    print(f'Results: {success} success, {no_gps} no GPS, {failed} failed')
    return success, no_gps, failed

if __name__ == '__main__':
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    s, n, f = process_batch(batch_size)
    sys.exit(0)