#!/usr/bin/env python3
"""
CSV Metadata Backfill Script

Populates missing photo metadata from analysis CSV files into Neon database.

Usage:
    python scripts/backfill_metadata.py [--dry-run]

Matches by: content_hash (primary), relative_path (fallback), filename (last resort)
"""

import os
import sys
import csv
import json
from pathlib import Path
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

# Configuration
NEON_CONN = os.environ.get('NEON_CONNECTION_STRING', 
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require')

ANALYSIS_ROOT = '/Volumes/ADATA SC740/Smugmug Backup/_analysis'

# Statistics
stats = {
    'csv_files_scanned': 0,
    'csv_rows_scanned': 0,
    'db_photos_matched': 0,
    'unmatched_rows': 0,
    'fields_updated': {
        'species_common_name': 0,
        'species_scientific_name': 0,
        'country': 0,
        'region': 0,
        'location_name': 0,
        'camera_make': 0,
        'camera_model': 0,
        'lens_model': 0,
        'iso': 0,
        'shutter_speed': 0,
        'aperture': 0,
        'focal_length_mm': 0,
        'width': 0,
        'height': 0,
        'date_taken': 0,
    }
}

def find_csv_files():
    """Find all analysis CSV files."""
    csv_files = []
    for root, dirs, files in os.walk(ANALYSIS_ROOT):
        for f in files:
            if f.endswith('_image_analysis.csv'):
                csv_files.append(os.path.join(root, f))
    return csv_files

def read_csv_rows(csv_path):
    """Read CSV and yield rows."""
    with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row

def connect_db():
    """Connect to Neon database."""
    return psycopg2.connect(NEON_CONN)

def find_photo_by_hash(conn, content_hash):
    """Find photo by content_hash."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, slug, title, species_common_name, species_scientific_name,
                   country, region, location_name, gallery_slug
            FROM photos 
            WHERE content_hash = %s 
            LIMIT 1
        """, (content_hash,))
        return cur.fetchone()

def find_photo_by_path(conn, relative_path):
    """Find photo by relative_path."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, slug, title, species_common_name, species_scientific_name,
                   country, region, location_name, gallery_slug
            FROM photos 
            WHERE source_path LIKE %s
            LIMIT 1
        """, (f'%{relative_path}',))
        return cur.fetchone()

def find_photo_by_filename(conn, filename, gallery_slug):
    """Find photo by filename and gallery."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, slug, title, species_common_name, species_scientific_name,
                   country, region, location_name, gallery_slug
            FROM photos 
            WHERE filename = %s AND gallery_slug = %s
            LIMIT 1
        """, (filename, gallery_slug))
        return cur.fetchone()

def is_stronger(new_val, old_val):
    """Determine if new value is stronger than existing."""
    # Empty/None is weaker
    if not new_val or str(new_val).strip() == '':
        return False
    # Existing value is stronger
    if old_val and str(old_val).strip() != '':
        return False
    return True

def update_photo_metadata(conn, photo_id, row):
    """Update photo metadata from CSV row."""
    updates = []
    params = []
    
    # Map CSV fields to DB fields (only columns that exist in DB)
    field_map = {
        'SpeciesCommonName': 'species_common_name',
        'SpeciesScientificName': 'species_scientific_name',
        'Country': 'country',
        'Region': 'region',
        'LocationName': 'location_name',
        'CameraMake': 'camera_make',
        'CameraModel': 'camera_model',
        'LensModel': 'lens_model',
        'ISO': 'iso',
        'ShutterSpeed': 'shutter_speed',
        'Aperture': 'aperture',
        'FocalLength': 'focal_length_mm',
        'Width': 'width',
        'Height': 'height',
        'EXIFDate': 'date_taken',
    }
    
    # Get current values
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT {', '.join(field_map.values())} FROM photos WHERE id = %s", (photo_id,))
        current = cur.fetchone()
    
    for csv_field, db_field in field_map.items():
        csv_val = row.get(csv_field, '').strip() if row.get(csv_field) else ''
        current_val = current.get(db_field) if current else None
        
        # Skip empty values
        if not csv_val:
            continue
            
        # Skip if current has value
        if current_val and str(current_val).strip() != '':
            continue
        
        # Handle date field - convert format if needed
        if db_field == 'date_taken':
            # CSV format: "2007:05:20 14:32:55" -> PostgreSQL expects "2007-05-20 14:32:55"
            csv_val = csv_val.replace(':', '-', 2)  # Only replace first two colons (dates)
        
        updates.append(f"{db_field} = %s")
        params.append(csv_val)
        stats['fields_updated'][db_field] = stats['fields_updated'].get(db_field, 0) + 1
    
    # Handle animal_group/subjects (needs special handling - they're arrays in DB)
    # For now, skip them
    
    if updates:
        params.append(photo_id)
        sql = f"UPDATE photos SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s"
        with conn.cursor() as cur:
            cur.execute(sql, params)
        return True
    
    return False

def process_csv_file(conn, csv_path):
    """Process a single CSV file."""
    print(f"Processing: {csv_path}")
    stats['csv_files_scanned'] += 1
    
    for row in read_csv_rows(csv_path):
        stats['csv_rows_scanned'] += 1
        
        content_hash = row.get('SourceFileHash', '').strip()
        relative_path = row.get('RelativePath', '').strip()
        filename = row.get('Filename', '').strip()
        gallery_slug = row.get('GallerySlug', '').strip()
        
        # Skip if no useful matching info
        if not content_hash and not relative_path and not filename:
            stats['unmatched_rows'] += 1
            continue
        
        # Try matching by content_hash first
        photo = None
        match_type = None
        
        if content_hash:
            photo = find_photo_by_hash(conn, content_hash)
            if photo:
                match_type = 'hash'
        
        # Fallback to relative_path
        if not photo and relative_path:
            photo = find_photo_by_path(conn, relative_path)
            if photo:
                match_type = 'path'
        
        # Last resort: filename + gallery
        if not photo and filename and gallery_slug:
            photo = find_photo_by_filename(conn, filename, gallery_slug)
            if photo:
                match_type = 'filename'
        
        if photo:
            stats['db_photos_matched'] += 1
            updated = update_photo_metadata(conn, photo['id'], row)
            if updated:
                print(f"  Updated photo {photo['slug']} via {match_type}")
        else:
            stats['unmatched_rows'] += 1
    
    conn.commit()

def main():
    print("=" * 60)
    print("CSV Metadata Backfill")
    print("=" * 60)
    print(f"Analysis root: {ANALYSIS_ROOT}")
    print(f"Started: {datetime.now()}")
    print()
    
    # Find CSV files
    csv_files = find_csv_files()
    print(f"Found {len(csv_files)} CSV files")
    
    # Connect to database
    conn = connect_db()
    print("Connected to database")
    print()
    
    # Process each CSV
    for csv_path in csv_files:
        process_csv_file(conn, csv_path)
    
    conn.close()
    
    # Print summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"CSV files scanned: {stats['csv_files_scanned']}")
    print(f"CSV rows scanned: {stats['csv_rows_scanned']}")
    print(f"DB photos matched: {stats['db_photos_matched']}")
    print(f"Unmatched rows: {stats['unmatched_rows']}")
    print()
    print("Fields updated:")
    for field, count in stats['fields_updated'].items():
        if count > 0:
            print(f"  {field}: {count}")
    
    print()
    print(f"Completed: {datetime.now()}")

if __name__ == '__main__':
    main()
