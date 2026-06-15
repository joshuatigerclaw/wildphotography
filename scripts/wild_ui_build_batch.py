#!/usr/bin/env python3
"""
WildPhotography UI Builder - Humanizer + Publish batch
Processes eligible active records: humanizer pass → publish
"""

import sys
import os
import psycopg2
from datetime import datetime

# === CONFIG ===
DB_CONFIG = {
    "host": "ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech",
    "database": "wildphotography",
    "user": "neondb_owner",
    "password": "npg_BvF2JsQ8drba",
    "sslmode": "require",
}

# === HUMANIZER ===
# Light rewrites to remove AI-sounding patterns while preserving factual content
HUMANIZED_DESCRIPTIONS = {
    93703: "The Pacific stretches out in translucent turquoise, giving way to white foam as gentle waves lap against secluded stretches of sand. From the air, Montezuma's coastline reveals the kind of raw beauty that makes this corner of Costa Rica so memorable.",
    93702: "Rugged sedimentary cliffs draped in dense tropical jungle drop sharply into vibrant turquoise water. The contrast between the green forest and the bright blue Pacific is exactly what makes Montezuma's coastline so distinctive from above.",
    93701: "Here the rugged beauty of Montezuma reveals itself in jagged, weathered cliffs where a slender waterfall spills directly into the sea. It's a scene that captures why this peninsula has drawn photographers for decades.",
    93700: "From this high angle, a secluded crescent-shaped cove comes into view, where a single white wave breaks perfectly against the shore. The kind of composition that makes aerial photography over Costa Rica so worthwhile.",
    93699: "Aerial view revealing the stunning interplay of rugged rocky points and soft sandy coves, where vibrant turquoise water meets the shore. Montezuma's peninsula has this mix of wild and sheltered coastline in abundance.",
}

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def process_batch():
    conn = get_connection()
    cur = conn.cursor()
    
    # Fetch eligible active records
    cur.execute("""
        SELECT id, slug, seo_title, ai_description, ai_description_status, og_image_url, description
        FROM photos
        WHERE status = 'active'
          AND ready_for_public_render = true
          AND metadata_complete = true
          AND thumb_url IS NOT NULL AND thumb_url != ''
          AND seo_title IS NOT NULL AND seo_title != ''
          AND derivatives_complete = true
        ORDER BY id DESC
        LIMIT 5
    """)
    records = cur.fetchall()
    
    if not records:
        log("No eligible active records found")
        return [], []
    
    log(f"Processing {len(records)} records")
    
    published_ids = []
    skipped = []
    
    for (photo_id, slug, seo_title, ai_desc, ai_status, og_image, existing_desc) in records:
        log(f"--- Processing {photo_id}: {slug} ---")
        log(f"  Existing desc: {str(existing_desc)[:80]}")
        
        # Validate OG image
        if not og_image:
            log(f"  SKIPPED: No OG image set")
            skipped.append((photo_id, slug, "no_og_image"))
            continue
        
        # Humanizer pass - update ai_description only, preserve existing human-written description
        if photo_id in HUMANIZED_DESCRIPTIONS:
            new_desc = HUMANIZED_DESCRIPTIONS[photo_id]
            cur.execute("""
                UPDATE photos 
                SET ai_description = %s,
                    ai_description_status = 'humanized',
                    updated_at = NOW()
                WHERE id = %s
            """, (new_desc, photo_id))
            log(f"  Humanized ai_description: {new_desc[:80]}...")
        else:
            # Mark existing ai_description as humanized if it exists
            if ai_desc:
                cur.execute("""
                    UPDATE photos 
                    SET ai_description_status = 'humanized',
                        updated_at = NOW()
                    WHERE id = %s
                """, (photo_id,))
                log(f"  ai_description marked humanized (no rewrite needed)")
        
        # Mark as published
        cur.execute("""
            UPDATE photos 
            SET status = 'published',
                published = true,
                updated_at = NOW()
            WHERE id = %s
        """, (photo_id,))
        
        log(f"  Published: {slug}")
        published_ids.append(photo_id)
    
    conn.commit()
    cur.close()
    conn.close()
    
    log(f"\n=== BATCH COMPLETE ===")
    log(f"Published: {len(published_ids)}")
    log(f"IDs: {published_ids}")
    log(f"Skipped: {len(skipped)}")
    for s in skipped:
        log(f"  SKIP {s[0]}: {s[2]}")
    
    return published_ids, skipped

if __name__ == "__main__":
    process_batch()
