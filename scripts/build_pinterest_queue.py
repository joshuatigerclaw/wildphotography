#!/usr/bin/env python3
"""
Build Pinterest Pin Queue for WildPhotography.com
Populates pin_queue with fresh photos not yet queued.
"""

import os
import sys
import json
import time
import re
import psycopg2
from datetime import datetime, timedelta

DB_URL = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
LOG_FILE = "/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/pinterest_queue_log.txt"

BOARD_ID_MAP = {
    'wildlife': '1',   # Costa Rica Wildlife & Birds
    'bird': '1',       # Costa Rica Wildlife & Birds  
    'beach': '2',      # Costa Rica Travel & Nature
    'coast': '2',      # Costa Rica Travel & Nature
    'travel': '2',     # Costa Rica Travel & Nature
    'nature': '2',      # Costa Rica Travel & Nature
    'photography': '3', # Costa Rica Photography
}

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def get_db():
    return psycopg2.connect(DB_URL)

def pick_board(title, description, location_name, species_common_name):
    """Pick the best board based on keywords"""
    text = f"{title} {description} {location_name or ''} {species_common_name or ''}".lower()
    
    if any(w in text for w in ['bird', 'macaw', 'toucan', 'quetzal', 'pelican', 'heron', 'owl', 'eagle', 'hawk', 'hummingbird', 'wildlife']):
        return '1'
    if any(w in text for w in ['beach', 'coast', 'ocean', 'surf', 'pacific', 'caribbean']):
        return '2'
    if any(w in text for w in ['park', 'volcano', 'mountain', 'forest', 'river', 'waterfall', 'trail', 'reserve']):
        return '2'
    return '3'  # Default to Photography

def truncate(text, max_len):
    if not text:
        return ''
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= max_len:
        return text
    return text[:max_len-3] + '...'

def build_pin_title(title, species, location):
    """Build pin title 40-80 chars"""
    species = species or ''
    location = location or ''
    
    # Try species + location template first
    if species and location:
        t = f"{species} {location} Costa Rica Photography"
        if 40 <= len(t) <= 80:
            return truncate(t, 80)
    
    if location:
        t = f"{location} Costa Rica Wildlife Photography"
        if 40 <= len(t) <= 80:
            return truncate(t, 80)
    
    if species:
        t = f"{species} Costa Rica Photography"
        if 40 <= len(t) <= 80:
            return truncate(t, 80)
    
    # Fall back to title
    return truncate(title, 60) if title else 'Costa Rica Photography'

def build_pin_description(title, location, species, description):
    """Build pin description 150-400 chars"""
    location = location or 'Costa Rica'
    subject = species or 'wildlife and nature'
    
    templates = [
        f"Original Costa Rica photography from {location}. {subject.title()}, tropical birds, wildlife, landscapes and travel images by Joshua ten Brink. View the full collection at WildPhotography.com.",
        f"Explore authentic Costa Rica photography from {location}, featuring {subject}, exotic birds, and stunning tropical scenery. See more at WildPhotography.com by Joshua ten Brink.",
        f"Professional Costa Rica wildlife and travel photography from {location}. Includes {subject} and tropical photography. Full gallery at WildPhotography.com.",
    ]
    
    for t in templates:
        if 150 <= len(t) <= 400:
            return t
    
    # Truncate/extend to fit
    base = f"Original Costa Rica photography from {location}. {subject.title()}, tropical birds, wildlife, landscapes and travel images. See more at WildPhotography.com."
    if len(base) < 150:
        base += " Professional wildlife photography from Costa Rica by Joshua ten Brink."
    return truncate(base, 400)

def main():
    log("=== Pinterest Queue Builder Started ===")
    conn = get_db()
    cur = conn.cursor()
    
    # Get current queue count
    cur.execute("SELECT COUNT(*), status FROM pin_queue GROUP BY status")
    queue_stats = cur.fetchall()
    log(f"Current queue: {', '.join(f'{c} {s}' for c, s in queue_stats)}")
    
    # Get photos not in queue (excluding those posted in last 90 days)
    ninety_days_ago = datetime.now() - timedelta(days=90)
    
    cur.execute("""
        SELECT p.id, p.slug, p.title, p.description, p.location_name, p.region, 
               p.country, p.species_common_name, p.thumb_url, p.medium_url, 
               p.large_url, p.og_image_url, p.seo_title, p.gallery_slug, p.views_count
        FROM photos p
        WHERE p.search_ready = true
          AND p.is_active = true
          AND p.ready_for_public_render = true
          AND p.thumb_url IS NOT NULL
          AND p.id NOT IN (
            SELECT photo_id FROM pin_queue 
            WHERE photo_id IS NOT NULL 
            AND status IN ('published', 'drafted')
          )
          AND p.id NOT IN (
            SELECT article_id::integer FROM pinterest_pin_queue 
            WHERE article_id IS NOT NULL AND posted_at IS NOT NULL
            AND posted_at > %s
          )
        ORDER BY p.views_count DESC NULLS LAST
        LIMIT 500
    """, (ninety_days_ago,))
    
    photos = cur.fetchall()
    log(f"Found {len(photos)} eligible photos not in queue")
    
    new_queued = 0
    skipped = 0
    board_counts = {'1': 0, '2': 0, '3': 0}
    
    for row in photos:
        photo_id, slug, title, description, location_name, region, country, species, thumb_url, medium_url, large_url, og_image_url, seo_title, gallery_slug, views_count = row
        
        # Use og_image_url or medium_url as image
        image_url = og_image_url or medium_url or large_url or thumb_url
        if not image_url:
            skipped += 1
            continue
        
        # Build pin data
        pin_title = build_pin_title(title, species, location_name)
        pin_description = build_pin_description(title, location_name, species, description)
        board_id = pick_board(title, description or '', location_name, species)
        destination_url = f"https://wildphotography.com/photo/{slug}?utm_source=pinterest&utm_medium=social&utm_campaign=photo_growth"
        
        try:
            cur.execute("""
                INSERT INTO pin_queue 
                (photo_id, destination_url, board_id, pin_title, pin_description, status, priority, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 'drafted', 50, NOW(), NOW())
            """, (photo_id, destination_url, board_id, pin_title, pin_description))
            
            conn.commit()
            new_queued += 1
            board_counts[board_id] = board_counts.get(board_id, 0) + 1
            
            if new_queued % 50 == 0:
                log(f"  Queued {new_queued} pins...")
                
        except psycopg2.IntegrityError:
            conn.rollback()
            skipped += 1
        except Exception as e:
            conn.rollback()
            log(f"  Error inserting photo {photo_id}: {e}")
            skipped += 1
        
        time.sleep(0.1)  # Brief pause
    
    cur.close()
    conn.close()
    
    log(f"\n=== Summary ===")
    log(f"New photos queued: {new_queued}")
    log(f"Skipped (already queued or no image): {skipped}")
    log(f"Board distribution: Wildlife&Birds={board_counts.get('1',0)}, Travel&Nature={board_counts.get('2',0)}, Photography={board_counts.get('3',0)}")
    log("=== Done ===")

if __name__ == "__main__":
    main()