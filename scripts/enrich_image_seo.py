#!/usr/bin/env python3
"""
Phase 3 — Image SEO Enrichment
Finds photos that are search_ready=true but missing seo_title or og_image_url,
and populates those fields in batches of 25.
"""

import psycopg2
import time
import json
from datetime import datetime

DATABASE_URL = (
    "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech"
    "/wildphotography?sslmode=require&channel_binding=require"
)
R2_CDN_BASE = "https://images.wildphotography.com"
BATCH_SIZE = 25
SLEEP_MS = 500
LOG_FILE = "/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/seo_enrichment_log.txt"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def build_og_url(medium_url, large_url):
    """Pick the first available CDN URL, preferring medium_url."""
    for src in [medium_url, large_url]:
        if src:
            if src.startswith("http"):
                return src
            return f"{R2_CDN_BASE}/{src}"
    return None

def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Count totals
    cur.execute("""
        SELECT COUNT(*)
        FROM photos
        WHERE search_ready = true
          AND (seo_title IS NULL OR seo_title = '' OR og_image_url IS NULL OR og_image_url = '')
    """)
    total_missing = cur.fetchone()[0]
    log(f"Photos missing SEO fields (search_ready=true): {total_missing}")

    cur.execute("""
        SELECT COUNT(*)
        FROM photos
        WHERE search_ready = true
          AND seo_title IS NOT NULL AND seo_title != ''
    """)
    already_have_seo_title = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM photos
        WHERE search_ready = true
          AND og_image_url IS NOT NULL AND og_image_url != ''
    """)
    already_have_og = cur.fetchone()[0]

    log(f"Photos already with seo_title: {already_have_seo_title}")
    log(f"Photos already with og_image_url: {already_have_og}")
    log(f"Will process: {total_missing} photos in batches of {BATCH_SIZE}")

    # Fetch missing
    cur.execute("""
        SELECT id, title, location, region, country, medium_url, large_url, keywords
        FROM photos
        WHERE search_ready = true
          AND (seo_title IS NULL OR seo_title = '' OR og_image_url IS NULL OR og_image_url = '')
        ORDER BY id
    """)
    missing_rows = cur.fetchall()

    total_updated = 0
    updated_seo_title = 0
    updated_og = 0
    errors = 0
    error_details = []
    sample_outputs = []

    for i in range(0, len(missing_rows), BATCH_SIZE):
        batch = missing_rows[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        log(f"Processing batch {batch_num} ({len(batch)} photos)...")

        for row in batch:
            photo_id, title, location, region, country, medium_url, large_url, keywords = row

            try:
                new_seo_title = None
                new_og = None

                # Determine og_image_url
                if not (medium_url or large_url):
                    log(f"  Photo {photo_id}: no medium_url or large_url, skipping")
                    errors += 1
                    error_details.append(f"photo_id={photo_id}: no media URLs")
                    continue

                new_og = build_og_url(medium_url, large_url)

                # Determine seo_title
                if title and title.strip():
                    new_seo_title = title.strip()
                else:
                    # Generate from location/region/country
                    parts = [p for p in [location, region, country] if p]
                    location_str = " ".join(parts) if parts else "Costa Rica"
                    new_seo_title = f"{location_str} Costa Rica Wildlife Photography"

                # Build alt_text candidate (for meta_description / keywords)
                alt_candidate = new_seo_title

                # Update
                cur.execute("""
                    UPDATE photos
                    SET seo_title = %s,
                        og_image_url = %s
                    WHERE id = %s
                """, (new_seo_title, new_og, photo_id))

                # Append alt_text to keywords JSONB if not already present
                if keywords and isinstance(keywords, list):
                    kw_list = keywords
                elif keywords and isinstance(keywords, str):
                    try:
                        kw_list = json.loads(keywords)
                    except:
                        kw_list = []
                else:
                    kw_list = []

                if alt_candidate and alt_candidate not in kw_list:
                    kw_list.append(alt_candidate)
                    cur.execute("""
                        UPDATE photos
                        SET keywords = %s
                        WHERE id = %s
                    """, (json.dumps(kw_list), photo_id))

                total_updated += 1
                if new_seo_title:
                    updated_seo_title += 1
                if new_og:
                    updated_og += 1

                sample_outputs.append({
                    "photo_id": photo_id,
                    "seo_title": new_seo_title,
                    "og_image_url": new_og,
                })

            except Exception as e:
                errors += 1
                error_details.append(f"photo_id={photo_id}: {str(e)}")
                log(f"  ERROR photo {photo_id}: {e}")

        conn.commit()
        log(f"  Batch {batch_num} committed.")
        time.sleep(SLEEP_MS / 1000.0)

    cur.close()
    conn.close()

    log("\n=== PHASE 3 RESULTS ===")
    log(f"Total photos updated: {total_updated}")
    log(f"  - seo_title populated: {updated_seo_title}")
    log(f"  - og_image_url populated: {updated_og}")
    log(f"Errors: {errors}")
    if error_details:
        for d in error_details[:20]:
            log(f"  ERROR DETAIL: {d}")

    log("\n=== SAMPLE SEO OUTPUTS (first 5) ===")
    for s in sample_outputs[:5]:
        log(f"  photo_id={s['photo_id']} | seo_title={s['seo_title']} | og={s['og_image_url']}")

    print("\nDONE. See log for details.")

if __name__ == "__main__":
    # Clear previous log on run
    with open(LOG_FILE, "w") as f:
        f.write("")
    main()
