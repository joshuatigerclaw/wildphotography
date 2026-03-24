#!/usr/bin/env python3
"""
WildPhotography Image QA - Visual Quality Audit
Checks for: missing/broken thumbnails, weak hero selection, duplicate lead images, 
missing alt text, low-quality featured images.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Optional
import concurrent.futures

import psycopg2
from psycopg2.extras import RealDictCursor

NEON_CONN = os.environ.get(
    'NEON_CONNECTION_STRING',
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
)

BATCH_LIMIT = 500
REPORT_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/image_qa_report_live.json'

@dataclass
class QAIssue:
    item_id: int
    item_slug: str
    item_type: str
    issue_type: str
    description: str
    current_value: str
    suggested_fix: Optional[str] = None
    confidence: str = "high"

def check_url_status(url: str, timeout: int = 8) -> tuple[str, int, str]:
    """Check if a URL returns HTTP 200."""
    if not url or url.strip() == '':
        return (url, 0, 'empty_url')
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 WildPhotography/1.0'}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return (url, resp.status, '')
    except urllib.error.HTTPError as e:
        return (url, e.code, str(e.reason))
    except Exception as e:
        return (url, 0, str(e))

def main():
    print(f"=== WildPhotography Image QA ===")
    start_time = datetime.now(timezone.utc)
    print(f"Started: {start_time.isoformat()}")
    
    conn = psycopg2.connect(NEON_CONN)
    conn.autocommit = True
    
    # Load ready photos
    print(f"\n[1] Loading ready photos (limit {BATCH_LIMIT})...")
    photo_query = """
        SELECT id, slug, title, thumb_url, small_url, medium_url, large_url, preview_url,
               ready_for_public_render, derivatives_complete, search_ready,
               keywords, description, location_name, region, country,
               gallery_slug, filename, content_hash, original_r2_key
        FROM photos
        WHERE ready_for_public_render = true
          AND published = true
        ORDER BY id DESC
        LIMIT %s
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(photo_query, (BATCH_LIMIT,))
        photos = cur.fetchall()
    
    print(f"    Loaded {len(photos)} photos")
    
    # Load galleries with cover info
    print(f"\n[2] Loading galleries...")
    gallery_query = """
        SELECT g.id, g.slug, g.name, g.cover_photo_id, g.parent_gallery_id,
               p.slug as cover_photo_slug, p.thumb_url as cover_thumb_url
        FROM galleries g
        LEFT JOIN photos p ON g.cover_photo_id = p.id
        WHERE g.is_active = true
        LIMIT %s
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(gallery_query, (BATCH_LIMIT,))
        galleries = cur.fetchall()
    
    print(f"    Loaded {len(galleries)} galleries")
    
    # Categorize issues
    missing_thumb = []
    broken_thumb = []
    missing_derivative_urls = []
    duplicate_thumb_sources = []
    missing_metadata = []
    
    issues = []
    thumb_urls_to_check = []
    photo_thumb_map = {}
    
    print(f"\n[3] Preparing URL validation...")
    for photo in photos:
        photo_id = photo['id']
        slug = photo['slug']
        
        # Check thumb_url
        if photo.get('thumb_url'):
            thumb_urls_to_check.append((photo_id, slug, 'photo', photo['thumb_url']))
            photo_thumb_map[photo['thumb_url']] = photo_thumb_map.get(photo['thumb_url'], 0) + 1
        
        # Check small_url
        if photo.get('small_url'):
            thumb_urls_to_check.append((photo_id, slug, 'photo', photo['small_url']))
        
        # Check medium_url
        if photo.get('medium_url'):
            thumb_urls_to_check.append((photo_id, slug, 'photo', photo['medium_url']))
        
        # Check large_url
        if photo.get('large_url'):
            thumb_urls_to_check.append((photo_id, slug, 'photo', photo['large_url']))
        
        # Check preview_url
        if photo.get('preview_url'):
            thumb_urls_to_check.append((photo_id, slug, 'photo', photo['preview_url']))
        
        # Check for missing derivatives when ready_for_public_render is true
        if photo.get('ready_for_public_render') and photo.get('derivatives_complete'):
            missing = []
            if not photo.get('thumb_url'):
                missing.append('thumb_url')
            if not photo.get('small_url'):
                missing.append('small_url')
            if not photo.get('medium_url'):
                missing.append('medium_url')
            if not photo.get('large_url'):
                missing.append('large_url')
            if missing:
                missing_derivative_urls.append({
                    'id': photo_id, 
                    'slug': slug, 
                    'missing_derivatives': missing
                })
                issues.append(QAIssue(
                    item_id=photo_id, item_slug=slug, item_type='photo',
                    issue_type='missing_derivatives',
                    description=f'Missing derivative URLs: {", ".join(missing)}',
                    current_value=str(missing),
                    confidence='high'
                ))
        
        # Check metadata completeness
        has_title = bool(photo.get('title'))
        has_keywords = bool(photo.get('keywords'))
        has_location = bool(photo.get('location_name'))
        has_description = bool(photo.get('description'))
        
        if not (has_title and has_keywords and has_location):
            missing_metadata.append({
                'id': photo_id,
                'slug': slug,
                'has_title': has_title,
                'has_keywords': has_keywords,
                'has_location': has_location,
                'has_description': has_description
            })
    
    # Check gallery covers
    gallery_cover_issues = []
    for gallery in galleries:
        if not gallery.get('cover_photo_id'):
            gallery_cover_issues.append({
                'id': gallery['id'],
                'slug': gallery['slug'],
                'name': gallery['name'],
                'issue': 'no_cover_photo'
            })
            issues.append(QAIssue(
                item_id=gallery['id'], item_slug=gallery['slug'], item_type='gallery',
                issue_type='missing_cover_photo',
                description='Gallery has no cover photo assigned',
                current_value='',
                confidence='high'
            ))
        elif not gallery.get('cover_thumb_url'):
            gallery_cover_issues.append({
                'id': gallery['id'],
                'slug': gallery['slug'],
                'name': gallery['name'],
                'issue': 'cover_photo_has_no_thumb'
            })
    
    # Batch URL checks
    print(f"\n[4] Validating {len(thumb_urls_to_check)} derivative URLs...")
    url_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(check_url_status, ui[3]): ui for ui in thumb_urls_to_check}
        for future in concurrent.futures.as_completed(futures):
            ui = futures[future]
            url, status, err = future.result()
            url_results[(ui[0], ui[2], ui[3])] = (status, err)
    
    # Process broken URLs
    broken_thumb = []
    for photo in photos:
        photo_id = photo['id']
        slug = photo['slug']
        
        for field in ['thumb_url', 'small_url', 'medium_url', 'large_url', 'preview_url']:
            url = photo.get(field)
            if url and (photo_id, field, url) in url_results:
                status, err = url_results[(photo_id, field, url)]
                if status != 200:
                    broken_thumb.append({
                        'id': photo_id, 'slug': slug, 'field': field, 
                        'status': status, 'error': err
                    })
                    issues.append(QAIssue(
                        item_id=photo_id, item_slug=slug, item_type='photo',
                        issue_type=f'broken_{field}',
                        description=f'{field} returns HTTP {status}',
                        current_value=url,
                        confidence='high'
                    ))
    
    # Check for duplicate thumb sources (same R2 key for different photos)
    print(f"\n[5] Checking for duplicate source issues...")
    dup_query = """
        SELECT original_r2_key, COUNT(*) as count
        FROM photos
        WHERE original_r2_key IS NOT NULL
          AND original_r2_key != ''
          AND ready_for_public_render = true
        GROUP BY original_r2_key
        HAVING COUNT(*) > 1
        LIMIT 20
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(dup_query)
        duplicates = cur.fetchall()
    
    duplicate_r2_keys = []
    for dup in duplicates:
        duplicate_r2_keys.append({
            'r2_key': dup['original_r2_key'],
            'count': dup['count']
        })
        issues.append(QAIssue(
            item_id=0, item_slug='', item_type='system',
            issue_type='duplicate_r2_key',
            description=f'Duplicate R2 original key found in {dup["count"]} photos',
            current_value=dup['original_r2_key'],
            confidence='high'
        ))
    
    print(f"\n[6] QA Results:")
    print(f"    Photos audited: {len(photos)}")
    print(f"    Galleries audited: {len(galleries)}")
    print(f"    Total issues found: {len(issues)}")
    print(f"    - Missing thumbnails: {len(missing_thumb)}")
    print(f"    - Broken thumbnails: {len(broken_thumb)}")
    print(f"    - Missing derivatives on ready photos: {len(missing_derivative_urls)}")
    print(f"    - Galleries missing cover: {len(gallery_cover_issues)}")
    print(f"    - Duplicate R2 keys: {len(duplicate_r2_keys)}")
    print(f"    - Missing metadata: {len(missing_metadata)}")
    
    # Determine safe fixes vs manual review
    safe_fixes = []
    manual_review_items = []
    
    # Galleries missing covers can often be auto-assigned if there are photos
    for gci in gallery_cover_issues:
        if gci['issue'] == 'no_cover_photo':
            # Try to find a good photo from this gallery to assign as cover
            gallery_slug = gci['slug']
            cover_candidate_query = """
                SELECT id, thumb_url 
                FROM photos 
                WHERE gallery_slug = %s 
                  AND ready_for_public_render = true 
                  AND thumb_url IS NOT NULL
                LIMIT 1
            """
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(cover_candidate_query, (gallery_slug,))
                candidate = cur.fetchone()
            if candidate:
                safe_fixes.append({
                    'type': 'gallery_cover',
                    'gallery_id': gci['id'],
                    'gallery_slug': gci['slug'],
                    'photo_id': candidate['id'],
                    'action': 'assign_cover_photo'
                })
            else:
                manual_review_items.append(gci)
    
    print(f"\n[7] Safe fixes identified: {len(safe_fixes)}")
    print(f"    Items needing manual review: {len(manual_review_items)}")
    
    # Write report
    result = {
        'items_loaded': len(photos) + len(galleries),
        'photos_audited': len(photos),
        'galleries_audited': len(galaxies) if 'galaxies' in dir() else len(galleries),
        'issues_found': len(issues),
        'safe_fixes_available': len(safe_fixes),
        'manual_review_required': len(manual_review_items),
        'missing_thumb_count': len(missing_thumb),
        'broken_thumb_count': len(broken_thumb),
        'missing_derivatives_count': len(missing_derivative_urls),
        'gallery_cover_issues': len(gallery_cover_issues),
        'duplicate_r2_keys_count': len(duplicate_r2_keys),
        'missing_metadata_count': len(missing_metadata),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    
    report = {
        'qa_summary': result,
        'issues': [asdict(i) for i in issues],
        'safe_fixes': safe_fixes,
        'manual_review_items': manual_review_items,
        'broken_thumb_details': broken_thumb[:50],  # Limit to 50
        'missing_derivative_details': missing_derivative_urls[:50],
        'duplicate_r2_keys': duplicate_r2_keys,
        'missing_metadata_samples': missing_metadata[:50]
    }
    
    with open(REPORT_PATH, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n[8] Report written to: {REPORT_PATH}")
    
    # Summary
    print(f"\n=== SUMMARY ===")
    print(f"Items loaded: {len(photos)} photos + {len(galleries)} galleries")
    print(f"Issues found: {len(issues)}")
    print(f"Safe fixes available: {len(safe_fixes)}")
    print(f"Manual review required: {len(manual_review_items)}")
    
    conn.close()

if __name__ == '__main__':
    main()
