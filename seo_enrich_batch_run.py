#!/usr/bin/env python3
"""SEO Enricher - One batch (50) photos with search_ready=false."""

import subprocess
import sys
import re
from datetime import datetime

DB_URL = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

def humanize(text):
    if not text:
        return text
    text = text.strip()
    text = re.sub(r'\bNestled\b', 'Tucked', text)
    text = re.sub(r'\bEmbracing\b', 'Framed by', text)
    text = re.sub(r'\bBreathtaking\b', 'Stunning', text)
    text = re.sub(r'\bTranquil\b', 'Peaceful', text)
    text = re.sub(r'\bPristine\b', 'Crystal-clear', text)
    text = re.sub(r'\bSerene\b', 'Calm', text)
    text = re.sub(r'\bVibrant\b', 'Bright', text)
    text = re.sub(r'\bLush\b', 'Green', text)
    text = re.sub(r'\bUntamed\b', 'Wild', text)
    text = re.sub(r'\bPanoramic\b', 'Wide', text)
    text = re.sub(r'\bExpansive\b', 'Open', text)
    text = re.sub(r'\bCaptivating\b', 'Striking', text)
    text = re.sub(r'\bIdyllic\b', 'Perfect', text)
    text = re.sub(r'\bSecluded\b', 'Quiet', text)
    text = re.sub(r'\bRemote\b', 'Off-the-beaten-path', text)
    text = re.sub(r'\bQuintessential\b', '', text)
    text = re.sub(r'\bFeaturing\b', '', text)
    text = re.sub(r'\bShowcasing\b', '', text)
    text = re.sub(r'\bShowcases\b', 'Shows', text)
    text = re.sub(r'\boffers\b', 'has', text)
    text = re.sub(r'\bProvides\b', 'Gives', text)
    text = re.sub(r'\bDiscover\b', 'See', text)
    text = re.sub(r'\bExperience\b', 'Enjoy', text)
    text = re.sub(r'\bExplore\b', 'Visit', text)
    text = re.sub(r'\bcharacterized by\b', 'with', text)
    text = re.sub(r'\bknown for\b', 'famous for', text)
    text = re.sub(r'\bsurrounded by\b', 'framed by', text)
    text = re.sub(r'\bfurthermore\b', '', text)
    text = re.sub(r'\bAdditionally\b', '', text)
    text = re.sub(r'\bIn this\b', 'Here', text)
    text = re.sub(r'\bThe image\b', 'This', text)
    text = re.sub(r'\bThis image\b', 'This', text)
    text = re.sub(r'\bThis photo\b', 'This', text)
    text = re.sub(r'\bThis photograph\b', 'This', text)
    text = re.sub(r'^, ', '', text)
    text = re.sub(r'\s+, ', ', ', text)
    text = re.sub(r'\s{2,}', ' ', text)
    text = text.strip(' ,.-')
    return text

def run_sql(query):
    cmd = ['psql', DB_URL, '-t', '-v', 'ON_ERROR_STOP=1']
    result = subprocess.run(cmd, input=query, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"SQL ERROR: {result.stderr}", file=sys.stderr)
        return None
    return result.stdout.strip()

# Gallery context for enrichment
GALLERY_CONTEXT = {
    5:  {"gallery": "Birds of Costa Rica",    "slug": "birds",                        "region": "Costa Rica",   "country": "Costa Rica"},
    6:  {"gallery": "Wildlife",               "slug": "wildlife",                     "region": "Costa Rica",   "country": "Costa Rica"},
    8:  {"gallery": "Rainforests",             "slug": "rainforests",                  "region": "Puntarenas",   "country": "Costa Rica"},
    9:  {"gallery": "Water Sports and Surfing","slug": "water-sports-and-surfing",     "region": "Guanacaste",   "country": "Costa Rica"},
    11: {"gallery": "Volcán Poás",            "slug": "volcan-poas",                  "region": "Alajuela",     "country": "Costa Rica"},
    12: {"gallery": "Turtles",                "slug": "turtles",                      "region": "Guanacaste",   "country": "Costa Rica"},
    13: {"gallery": "Rivers",                 "slug": "rivers",                       "region": "Puntarenas",   "country": "Costa Rica"},
    105:{"gallery": "Uncategorized",          "slug": "uncategorized",                "region": "Costa Rica",   "country": "Costa Rica"},
}

def enrich_photo(row):
    """Generate SEO metadata for a photo based on its current data and gallery context."""
    photo_id, gallery_id, title, description, keywords, location, gallery_slug = row
    
    ctx = GALLERY_CONTEXT.get(gallery_id, {"gallery": "Costa Rica", "slug": "", "region": "Costa Rica", "country": "Costa Rica"})
    
    # Use existing title/description if decent, otherwise build from context
    if title and len(title) > 5 and not title.startswith("landscape") and "—" not in title:
        seo_title = humanize(title)
    else:
        seo_title = humanize(f"{ctx['gallery']} Photography — Costa Rica")
    
    if description and len(description) > 20 and "WildPhotography" not in description:
        seo_desc = humanize(description)
    else:
        seo_desc = humanize(f"A {ctx['gallery'].lower()} photograph from Costa Rica by Joshua ten Brink. Part of the WildPhotography collection documenting the natural beauty of {ctx['region']}.")
    
    if keywords and len(keywords) > 10 and "WildPhotography" not in keywords:
        seo_keywords = keywords
    else:
        kw_parts = [ctx['gallery'], "Costa Rica", ctx['region'], "nature photography", "WildPhotography", "Joshua ten Brink"]
        if location:
            kw_parts.insert(0, location)
        seo_keywords = ", ".join(kw_parts)
    
    # Use existing location if present, else use region
    location_name = location if location else f"{ctx['region']}, Costa Rica"
    
    return {
        "title": seo_title,
        "description": seo_desc,
        "keywords": seo_keywords,
        "country": ctx['country'],
        "region": ctx['region'],
        "location_name": location_name,
    }

def update_photo(photo_id, seo_data):
    title = seo_data["title"].replace("'", "''")
    desc = seo_data["description"].replace("'", "''")
    keywords = seo_data["keywords"].replace("'", "''")
    country = seo_data["country"].replace("'", "''")
    region = seo_data["region"].replace("'", "''")
    location_name = seo_data["location_name"].replace("'", "''")
    
    query = f"""
    UPDATE photos SET
        title = '{title}',
        description = '{desc}',
        keywords = '{keywords}',
        country = '{country}',
        region = '{region}',
        location_name = '{location_name}',
        metadata_complete = true,
        search_ready = true,
        updated_at = now()
    WHERE id = {photo_id};
    """
    result = run_sql(query)
    return result is not None

def sync_typesense(photo_ids):
    try:
        from typesense import Client
        client = Client({
            'host': 'uibn03zvateqwdx2p-1.a1.typesense.net',
            'port': '443',
            'protocol': 'https',
            'api_key': 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7'
        })
        
        for pid in photo_ids:
            result = run_sql(f"""
            SELECT id, title, description, keywords, country, region, location_name,
                   gallery_slug, slug, thumb_url, medium_url, large_url
            FROM photos WHERE id = {pid};
            """)
            if result and result.strip():
                parts = [p.strip() for p in result.split('|')]
                if len(parts) >= 11:
                    doc = {
                        'id': str(parts[0]),
                        'title': parts[1] or '',
                        'description': parts[2] or '',
                        'keywords': parts[3] or '',
                        'country': parts[4] or '',
                        'region': parts[5] or '',
                        'location_name': parts[6] or '',
                        'gallery_slug': parts[7] or '',
                        'slug': parts[8] or '',
                        'thumb_url': parts[9] or '',
                        'medium_url': parts[10] or '',
                        'large_url': parts[11] if len(parts) > 11 else ''
                    }
                    try:
                        client.collections['photos'].documents.upsert(doc)
                    except Exception as e:
                        print(f"  Typesense upsert error {pid}: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Typesense sync error: {e}", file=sys.stderr)

def main():
    # Fetch 50 photos with search_ready=false
    query = """
    SELECT id, gallery_id, title, description, keywords, location, gallery_slug
    FROM photos
    WHERE search_ready = false
    ORDER BY id
    LIMIT 50;
    """
    output = run_sql(query)
    if not output or not output.strip():
        print("No photos found with search_ready=false")
        return
    
    photos = []
    for line in output.strip().split('\n'):
        if '|' in line:
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 7:
                try:
                    pid = int(parts[0])
                    gid = int(parts[1])
                    photos.append((pid, gid, parts[2], parts[3], parts[4], parts[5], parts[6]))
                except ValueError:
                    continue
    
    print(f"Found {len(photos)} photos needing enrichment")
    
    enriched = []
    failed = []
    errors = []
    
    for row in photos:
        photo_id, gallery_id = row[0], row[1]
        seo = enrich_photo(row)
        success = update_photo(photo_id, seo)
        if success:
            enriched.append(photo_id)
            print(f"  [{photo_id}] g{gallery_id} -> {seo['title'][:60]}")
        else:
            failed.append(photo_id)
            errors.append(f"Update failed for photo_id={photo_id}")
            print(f"  [ERROR] {photo_id}")
    
    # Sync successful updates to Typesense
    if enriched:
        print(f"\nSyncing {len(enriched)} records to Typesense...")
        sync_typesense(enriched)
    
    # Count remaining
    remaining_out = run_sql("SELECT COUNT(*) FROM photos WHERE search_ready = false;")
    remaining = int(remaining_out.strip()) if remaining_out else 0
    
    print(f"\n=== BATCH COMPLETE ===")
    print(f"enriched_count: {len(enriched)}")
    print(f"failed_count: {len(failed)}")
    print(f"errors: {errors}")
    print(f"next_batch_remaining: {remaining}")

if __name__ == '__main__':
    main()