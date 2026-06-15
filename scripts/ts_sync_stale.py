#!/usr/bin/env python3
"""WildPhotography — Small-batch Typesense sync for stale drift"""
import json, requests, psycopg2, os

TS_HOST = "uibn03zvateqwdx2p-1.a1.typesense.net"
TS_KEY = "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()

# Get 100 most recent stale drift photos
cur.execute("""
    SELECT p.id, p.slug, p.title, p.description, p.keywords, 
           p.species_common_name, p.location_name, p.country, p.region,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, 
           g.slug as gallery_slug
    FROM photos p
    LEFT JOIN galleries g ON g.id = p.gallery_id
    WHERE p.search_ready = true AND p.typesense_indexable = false 
      AND p.exclude_from_processing = false
    ORDER BY p.id DESC
    LIMIT 100
""")

rows = cur.fetchall()
print(f"Fetching {len(rows)} stale photos for TS sync...")

headers = {"X-Typesense-Api-Key": TS_KEY, "Content-Type": "application/json"}
coll_url = f"https://{TS_HOST}:443/collections/photos/documents"

upserted = 0
failed_ids = []
for row in rows:
    photo_id, slug, title, description, keywords, species, location, country, region, thumb, small, medium, large, gallery_slug = row
    doc = {
        "id": str(photo_id),
        "slug": slug or "",
        "title": title or "",
        "description": (description or "")[:500],
        "keywords": (keywords or "").split(",")[:20] if keywords else [],
        "species_common_name": species or "",
        "location_name": location or "",
        "country": country or "",
        "region": region or "",
        "gallery_slug": gallery_slug or "",
        "thumb_url": thumb or "",
        "small_url": small or "",
        "medium_url": medium or "",
        "large_url": large or ""
    }
    try:
        r = requests.post(coll_url, headers=headers, json=doc, timeout=10)
        if r.status_code in (200, 201):
            upserted += 1
        else:
            print(f"  FAIL {photo_id}: {r.status_code} {r.text[:80]}")
            failed_ids.append(photo_id)
    except Exception as e:
        print(f"  ERR {photo_id}: {e}")
        failed_ids.append(photo_id)

print(f"Upserted: {upserted}/{len(rows)}")

# Now update the flag for successful ones
if upserted > 0:
    cur.execute("""
        UPDATE photos 
        SET typesense_indexable = true 
        WHERE id IN (
            SELECT p.id FROM photos p
            WHERE p.search_ready = true AND p.typesense_indexable = false 
              AND p.exclude_from_processing = false
            ORDER BY p.id DESC
            LIMIT %s
        )
    """, (upserted,))
    conn.commit()
    print(f"Updated typesense_indexable=true for {upserted} records")

cur.close()
conn.close()
print("Done.")