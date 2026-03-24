#!/usr/bin/env python3
"""
WildPhotography Render Validation After Derivative Rebuild
Comprehensive validation of database state, derivative URLs, and page rendering.
"""

import concurrent.futures
import json
import os
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor

# DB connection
NEON_CONN = os.environ.get(
    'NEON_CONNECTION_STRING',
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
)

REPORT_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/render_validation_after_rebuild_report.json'
SAMPLE_SIZE = 100

# WildPhotography public site URL
WILD_BASE_URL = os.environ.get('WILD_PUBLIC_URL', 'https://wildphotography.com')
PAGES_TO_CHECK = ['homepage', 'galleries_index', 'gallery_detail', 'photo_detail', 'search_results', 'species_detail', 'regions']

@dataclass
class ValidationResult:
    workflow: str
    run_time: str
    validation_summary: dict
    previous_validation_summary: dict
    delta_since_previous: dict
    public_render_validation: dict
    broken_urls_status: dict
    render_validation_verdict: dict

def check_url(url: str, timeout: int = 10) -> tuple[str, int, str]:
    """Check if a URL returns HTTP 200. Returns (url, status_code, error_msg)."""
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 WildPhotography/1.0'}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return (url, resp.status, '')
    except urllib.error.HTTPError as e:
        return (url, e.code, str(e.reason))
    except urllib.error.URLError as e:
        return (url, 0, str(e.reason))
    except Exception as e:
        return (url, 0, str(e))

def get_canonical_domain(url: str) -> str:
    """Extract canonical domain from URL."""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if 'images.wildphotography' in host:
            return 'images_wildphoto'
        elif 'pub.wildphoto' in host:
            return 'pub_wildphoto'
        elif 'r2.dev' in host:
            return 'r2_dev'
        elif 'r2.cloudflarestorage' in host:
            return 'r2_cloudflarestorage'
        elif 'cloudflare' in host:
            return 'cloudflare_pages'
        else:
            return host.replace('.', '_')
    except:
        return 'unknown'

def get_db_summary(cur):
    """Get current database summary stats."""
    query = """
        SELECT 
            COUNT(*) as total_photos,
            SUM(CASE WHEN derivatives_complete = true THEN 1 ELSE 0 END) as derivatives_complete,
            SUM(CASE WHEN ready_for_public_render = true THEN 1 ELSE 0 END) as render_ready,
            SUM(CASE WHEN search_ready = true THEN 1 ELSE 0 END) as search_ready,
            SUM(CASE WHEN thumb_url IS NULL OR thumb_url = '' OR thumb_url = 'null' THEN 1 ELSE 0 END) as missing_thumb_url,
            SUM(CASE WHEN source_path IS NULL AND content_hash IS NULL AND thumb_url IS NOT NULL AND thumb_url != '' AND thumb_url != 'null' THEN 1 ELSE 0 END) as legacy_static,
            SUM(CASE WHEN source_path IS NULL AND content_hash IS NULL AND (original_r2_key IS NULL OR original_r2_key = '') AND (thumb_url IS NULL OR thumb_url = '' OR thumb_url = 'null') THEN 1 ELSE 0 END) as true_orphans
        FROM photos
    """
    cur.execute(query)
    row = cur.fetchone()
    return dict(row)

def check_page(url: str) -> dict:
    """Check if a page loads with HTTP 200."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 WildPhotography/1.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
            return {'status': resp.status, 'bytes': len(content), 'ok': True, 'error': None}
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'bytes': 0, 'ok': False, 'error': str(e.reason)}
    except Exception as e:
        return {'status': 0, 'bytes': 0, 'ok': False, 'error': str(e)}

def load_previous_summary():
    """Load previous validation summary if exists."""
    try:
        if os.path.exists(REPORT_PATH):
            with open(REPORT_PATH) as f:
                prev = json.load(f)
                return prev.get('validation_summary', {})
    except:
        pass
    return {}

def run_validation():
    print("=" * 60)
    print("WildPhotography Render Validation After Derivative Rebuild")
    print("=" * 60)
    
    # Load previous summary for delta
    prev_summary = load_previous_summary()
    prev_time = None
    if os.path.exists(REPORT_PATH):
        try:
            with open(REPORT_PATH) as f:
                prev_data = json.load(f)
                prev_time = prev_data.get('run_time', 'unknown')
        except:
            pass
    
    # Connect to Neon
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get DB summary
    db_summary = get_db_summary(cur)
    print(f"\nDatabase Summary:")
    print(f"  Total photos:         {db_summary['total_photos']}")
    print(f"  Derivatives complete: {db_summary['derivatives_complete']}")
    print(f"  Render ready:         {db_summary['render_ready']}")
    print(f"  Search ready:         {db_summary['search_ready']}")
    print(f"  Missing thumb_url:    {db_summary['missing_thumb_url']}")
    print(f"  Legacy static:        {db_summary['legacy_static']}")
    print(f"  True orphans:         {db_summary['true_orphans']}")
    
    # Sample derivative URLs
    query = """
        SELECT 
            p.id, p.slug, p.title,
            p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
            p.ready_for_public_render, p.derivatives_complete,
            g.slug as gallery_slug
        FROM photos p
        LEFT JOIN galleries g ON p.gallery_id = g.id
        WHERE p.ready_for_public_render = true
          AND p.thumb_url IS NOT NULL
          AND p.thumb_url != ''
          AND p.thumb_url != 'null'
        ORDER BY p.id DESC
        LIMIT %s
    """
    cur.execute(query, (SAMPLE_SIZE,))
    photos = cur.fetchall()
    print(f"\nSampled {len(photos)} ready-for-render photos for URL validation")
    
    cur.close()
    conn.close()
    
    # Collect thumb URLs to check
    urls_to_check = []
    for photo in photos:
        if photo['thumb_url']:
            urls_to_check.append({
                'photo_id': photo['id'],
                'slug': photo['slug'],
                'gallery_slug': photo['gallery_slug'],
                'url': photo['thumb_url'],
                'domain': get_canonical_domain(photo['thumb_url'])
            })
    
    print(f"Checking {len(urls_to_check)} thumbnail URLs...")
    
    # Check URLs concurrently
    http_200 = 0
    http_non_200 = 0
    errors = 0
    non_200_urls = []
    error_urls = []
    domain_breakdown = {}
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(check_url, item['url']): item for item in urls_to_check}
        
        for future in concurrent.futures.as_completed(futures, timeout=60):
            item = futures[future]
            try:
                url, status, err = future.result()
                domain = get_canonical_domain(url)
                
                domain_breakdown[domain] = domain_breakdown.get(domain, 0) + 1
                
                if status == 200:
                    http_200 += 1
                elif status > 0:
                    http_non_200 += 1
                    non_200_urls.append({
                        'photo_id': item['photo_id'],
                        'slug': item['slug'],
                        'gallery': item['gallery_slug'],
                        'url': url,
                        'status_code': status,
                        'error': err,
                        'domain': domain
                    })
                else:
                    errors += 1
                    error_urls.append({
                        'photo_id': item['photo_id'],
                        'slug': item['slug'],
                        'gallery': item['gallery_slug'],
                        'url': url,
                        'error': err,
                        'domain': domain
                    })
            except Exception as e:
                errors += 1
                error_urls.append({
                    'photo_id': item['photo_id'],
                    'slug': item['slug'],
                    'url': item['url'],
                    'error': str(e)
                })
    
    derivative_check = {
        'photos_tested': len(urls_to_check),
        'derivatives_checked': len(urls_to_check),
        'http_200': http_200,
        'http_non_200': http_non_200,
        'success_rate_pct': round((http_200 / len(urls_to_check) * 100), 1) if urls_to_check else 100.0
    }
    
    print(f"\nDerivative URL Checks:")
    print(f"  Photos tested:      {derivative_check['photos_tested']}")
    print(f"  HTTP 200:           {derivative_check['http_200']}")
    print(f"  HTTP non-200:       {derivative_check['http_non_200']}")
    print(f"  Errors/timeout:     {errors}")
    print(f"  Success rate:       {derivative_check['success_rate_pct']}%")
    print(f"\nDomain breakdown:")
    for domain, count in sorted(domain_breakdown.items(), key=lambda x: -x[1]):
        print(f"  {domain}: {count}")
    
    # Page rendering checks
    print(f"\nPage Rendering Checks:")
    page_results = {}
    
    # Build page URLs
    base = WILD_BASE_URL.rstrip('/')
    page_urls = {
        'homepage': f'{base}/',
        'galleries_index': f'{base}/galleries',
        'gallery_detail': f'{base}/galleries/birds/toucan',
        'photo_detail': f'{base}/photos/scarlet-macaw-costa-rica',
        'search_results': f'{base}/search?q=toucan',
        'species_detail': f'{base}/species/scarlet-macaw',
        'regions': f'{base}/regions'
    }
    
    for page_name in PAGES_TO_CHECK:
        if page_name in page_urls:
            url = page_urls[page_name]
            print(f"  Checking {page_name}...", end=" ")
            result = check_page(url)
            page_results[page_name] = result
            status_str = f"HTTP {result['status']}" if result['status'] else f"ERR: {result['error']}"
            print(status_str)
    
    # Broken URL analysis
    broken_by_type = {}
    for u in non_200_urls + error_urls:
        domain = u.get('domain', 'unknown')
        if domain not in broken_by_type:
            broken_by_type[domain] = {'count': 0, 'items': [], 'cause': 'unknown'}
        broken_by_type[domain]['count'] += 1
        if len(broken_by_type[domain]['items']) < 5:
            broken_by_type[domain]['items'].append(u)
    
    # Analyze causes
    broken_status = {}
    for domain, data in broken_by_type.items():
        cause = 'unknown'
        if 'cloudflarestorage' in domain:
            cause = 'R2 public URL auth changed - requires Cloudflare credentialed URLs'
        elif 'malformed' in domain or 'double' in str(data):
            cause = 'double-protocol URL'
        elif 'pub_r2' in domain or 'r2_dev' in domain:
            cause = 'Derivatives not yet generated in R2'
        
        broken_status[domain] = {
            'count': data['count'],
            'http_status': data['items'][0].get('status_code', 0) if data['items'] else 0,
            'cause': cause,
            'fixable': 'auth' not in cause.lower()
        }
    
    # Compute delta
    delta = {}
    if prev_summary:
        for key in ['total_photos', 'derivatives_complete', 'render_ready', 'search_ready', 'missing_thumb_url']:
            if key in prev_summary and key in db_summary:
                prev_val = prev_summary.get(key, 0) or 0
                curr_val = db_summary.get(key, 0) or 0
                delta[key] = curr_val - prev_val
    
    # Determine verdict
    total_checks = derivative_check['photos_tested'] + len(page_results)
    failed_checks = derivative_check['http_non_200'] + errors + sum(1 for r in page_results.values() if not r['ok'])
    fixable = sum(1 for d in broken_status.values() if d.get('fixable', False))
    unfixable = sum(1 for d in broken_status.values() if not d.get('fixable', True))
    
    verdict = {
        'status': 'PASS' if failed_checks == 0 else 'FAIL',
        'working_thumb_urls': http_200,
        'broken_urls_fixable': fixable,
        'broken_urls_unfixable': unfixable,
        'derivative_url_success_rate': f"{derivative_check['success_rate_pct']}%",
        'page_render_success_rate': f"{round((len(page_results) - sum(1 for r in page_results.values() if not r['ok'])) / len(page_results) * 100, 1)}%" if page_results else "100%",
        'total_checks_passed': total_checks - failed_checks,
        'total_checks_failed': failed_checks
    }
    
    print(f"\n--- Verdict ---")
    print(f"Status: {verdict['status']}")
    print(f"Working thumb URLs: {verdict['working_thumb_urls']}")
    print(f"Fixable broken URLs: {verdict['broken_urls_fixable']}")
    print(f"Unfixable broken URLs: {verdict['broken_urls_unfixable']}")
    print(f"Total checks passed: {verdict['total_checks_passed']}/{total_checks}")
    
    # Build result
    result = ValidationResult(
        workflow='wild_render_validation_after_derivative_rebuild',
        run_time=datetime.utcnow().isoformat() + 'Z',
        validation_summary=db_summary,
        previous_validation_summary=prev_summary,
        delta_since_previous=delta,
        public_render_validation={
            'derivative_url_checks': derivative_check,
            'page_rendering_checks': page_results
        },
        broken_urls_status=broken_status,
        render_validation_verdict=verdict
    )
    
    # Write report
    with open(REPORT_PATH, 'w') as f:
        json.dump(asdict(result), f, indent=2)
    
    print(f"\nFull report: {REPORT_PATH}")
    print("Done.")
    
    return result

if __name__ == '__main__':
    run_validation()