#!/usr/bin/env python3
"""
WildPhotography Public Render Validation
Verifies that public image URLs return HTTP 200 after asset URL updates.
"""

import concurrent.futures
import json
import os
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor

# DB connection
NEON_CONN = os.environ.get(
    'NEON_CONNECTION_STRING',
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
)

REPORT_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/public_render_validation_report.json'
SAMPLE_SIZE = 200

@dataclass
class ValidationResult:
    total_sampled: int
    http_200_count: int
    http_non_200_count: int
    error_count: int
    domain_breakdown: dict
    non_200_urls: list
    error_urls: list
    sample_time: str

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

def run_validation():
    print("=" * 60)
    print("WildPhotography Public Render Validation")
    print("=" * 60)
    
    # Connect to Neon
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Sample photos that are ready for public render
    # Focus on recently updated records and known problem domains
    query = """
        SELECT 
            p.id, p.slug, p.title,
            p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
            p.ready_for_public_render, p.derivatives_complete, p.search_ready,
            p.status,
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
    
    print(f"\nSampled {len(photos)} ready-for-render photos for validation")
    
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
    
    cur.close()
    conn.close()
    
    print(f"Checking {len(urls_to_check)} thumbnail URLs...")
    
    # Check URLs concurrently
    http_200 = 0
    http_non_200 = 0
    errors = 0
    non_200_urls = []
    error_urls = []
    domain_breakdown = {}
    
    def process_result(r):
        url, status, err = r
        domain = get_canonical_domain(url)
        return url, status, err, domain
    
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
    
    result = ValidationResult(
        total_sampled=len(urls_to_check),
        http_200_count=http_200,
        http_non_200_count=http_non_200,
        error_count=errors,
        domain_breakdown=domain_breakdown,
        non_200_urls=non_200_urls[:50],  # Cap at 50 examples
        error_urls=error_urls[:50],
        sample_time=datetime.utcnow().isoformat() + 'Z'
    )
    
    # Write report
    with open(REPORT_PATH, 'w') as f:
        json.dump(asdict(result), f, indent=2)
    
    print(f"\n--- Validation Results ---")
    print(f"Total sampled:      {result.total_sampled}")
    print(f"HTTP 200:           {result.http_200_count}")
    print(f"HTTP non-200:       {result.http_non_200_count}")
    print(f"Errors/timeout:     {result.error_count}")
    print(f"Success rate:       {(result.http_200_count/result.total_sampled*100):.1f}%")
    print(f"\nDomain breakdown:")
    for domain, count in sorted(result.domain_breakdown.items(), key=lambda x: -x[1]):
        print(f"  {domain}: {count}")
    
    if non_200_urls:
        print(f"\nNon-200 URLs (sample of {len(non_200_urls)}):")
        for u in non_200_urls[:5]:
            print(f"  [{u['status_code']}] {u['gallery']}/{u['slug']} -> {u['url']}")
    
    if error_urls:
        print(f"\nError/timeout URLs (sample of {len(error_urls)}):")
        for u in error_urls[:5]:
            print(f"  [ERR] {u['gallery']}/{u['slug']} -> {u['url']}: {u['error']}")
    
    print(f"\nFull report: {REPORT_PATH}")
    print("Done.")
    
    return result

if __name__ == '__main__':
    run_validation()
