#!/usr/bin/env python3
"""
WildPhotography Gallery Cover Assignment & Repair
Assigns or repairs cover photos for galleries.
"""

import psycopg2
import json
import os
from typing import Any

# Neon connection string - adapted for psycopg2
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

BATCH_LIMIT = 200

QUEUE_DIR = "/Users/joshuatenbrink/.openclaw/workspace"

def get_connection():
    return psycopg2.connect(NEON_CONN)

def load_galleries_needing_cover(conn, limit=200):
    """Load galleries that need cover photo assignment or repair.
    
    Categories:
    1. cover_photo_id IS NULL - needs new cover
    2. cover photo is inactive or not ready_for_public_render - needs repair
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT g.id, g.slug, g.name, g.cover_photo_id,
                   p.id as current_cover_id, p.slug as current_cover_slug,
                   p.ready_for_public_render as cover_ready,
                   p.thumb_url as cover_thumb
            FROM galleries g
            LEFT JOIN photos p ON g.cover_photo_id = p.id
            WHERE g.cover_photo_id IS NULL
               OR p.id IS NULL
               OR p.is_active = false
               OR p.ready_for_public_render = false
            ORDER BY
                CASE WHEN g.cover_photo_id IS NULL THEN 1
                     WHEN p.id IS NULL THEN 2
                     ELSE 3
                END,
                g.id
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()
    
    result = []
    for r in rows:
        cover_photo_id = r[3]
        current_cover_id = r[4]
        
        if cover_photo_id is None:
            cover_status = "missing"
        elif current_cover_id is None:
            cover_status = "cover_missing"
        else:
            cover_status = "cover_invalid"
        
        result.append({
            "id": r[0],
            "slug": r[1],
            "name": r[2],
            "cover_photo_id": cover_photo_id,
            "current_cover_id": current_cover_id,
            "current_cover_slug": r[5],
            "cover_ready": r[6],
            "cover_thumb": r[7],
            "cover_status": cover_status,
        })
    return result

def load_cover_candidates(conn, gallery_ids):
    """Load eligible cover photo candidates for given galleries."""
    if not gallery_ids:
        return {}
    
    placeholders = ','.join(['%s'] * len(gallery_ids))
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT gp.gallery_id, p.id, p.slug, p.title, p.thumb_url,
                   p.width, p.height, p.keywords,
                   p.ready_for_public_render, p.search_ready
            FROM photos p
            JOIN gallery_photos gp ON p.id = gp.photo_id
            WHERE gp.gallery_id IN ({placeholders})
              AND p.is_active = true
              AND p.ready_for_public_render = true
              AND p.thumb_url IS NOT NULL
              AND p.thumb_url <> ''
            ORDER BY gp.gallery_id,
                     p.ready_for_public_render DESC,
                     LENGTH(COALESCE(p.title, '')) DESC,
                     (COALESCE(p.width, 0) * COALESCE(p.height, 0)) DESC
        """, gallery_ids)
        rows = cur.fetchall()
    
    result = {}
    for r in rows:
        gallery_id = r[0]
        if gallery_id not in result:
            result[gallery_id] = []
        result[gallery_id].append({
            "photo_id": r[1],
            "slug": r[2],
            "title": r[3] or "",
            "thumb_url": r[4],
            "width": r[5] or 0,
            "height": r[6] or 0,
            "keywords": r[7] or "",
            "ready_for_public_render": r[8],
            "search_ready": r[9],
        })
    return result

def score_candidates(photos):
    """Score and rank candidates. Returns best candidate or None."""
    if not photos:
        return None
    
    # Best photo is first due to ORDER BY in query
    best = photos[0]
    
    score = 0
    if best.get("search_ready"):
        score += 10
    if best.get("title"):
        score += 5
    if best.get("width", 0) > 0 and best.get("height", 0) > 0:
        score += min((best["width"] * best["height"]) / 1_000_000, 10)
    
    best["score"] = score
    return best

def assign_or_repair_covers(conn, assignments):
    """Update galleries with assigned/repaired cover photo IDs."""
    if not assignments:
        return 0, 0
    
    assigned = 0
    repaired = 0
    with conn.cursor() as cur:
        for item in assignments:
            cur.execute("""
                UPDATE galleries
                SET cover_photo_id = %s
                WHERE id = %s
                  AND (cover_photo_id IS NULL OR cover_photo_id != %s)
            """, (item["photo_id"], item["gallery_id"], item["photo_id"]))
            if cur.rowcount > 0:
                if item["original_status"] == "missing":
                    assigned += 1
                else:
                    repaired += 1
    conn.commit()
    return assigned, repaired

def queue_manual_review(conn, items):
    """Write items to the manual review queue JSON file."""
    if not items:
        return 0
    
    gallery_ids = [item["gallery_id"] for item in items]
    placeholders = ','.join(['%s'] * len(gallery_ids)) if gallery_ids else 'NULL'
    
    with conn.cursor() as cur:
        if gallery_ids:
            cur.execute(f"""
                SELECT id, slug, name FROM galleries WHERE id IN ({placeholders})
            """, gallery_ids)
            gallery_rows = {r[0]: {"slug": r[1], "name": r[2]} for r in cur.fetchall()}
        else:
            gallery_rows = {}
    
    queue_path = os.path.join(QUEUE_DIR, "manual_review_queue.json")
    try:
        with open(queue_path, 'r') as f:
            queue = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        queue = []
    
    for item in items:
        gallery_info = gallery_rows.get(item["gallery_id"], {})
        queue.append({
            "type": "gallery_cover_manual_review",
            "gallery_id": item["gallery_id"],
            "gallery_slug": gallery_info.get("slug"),
            "gallery_name": gallery_info.get("name"),
            "reason": item.get("reason", "weak_candidate"),
            "original_cover_status": item.get("original_status"),
            "priority": 50,
            "status": "pending"
        })
    
    with open(queue_path, 'w') as f:
        json.dump(queue, f, indent=2)
    
    return len(items)

def main():
    print(f"[gallery_cover_assignment] Starting run at batch_limit={BATCH_LIMIT}")
    
    conn = get_connection()
    
    try:
        # Step 1: Load galleries needing cover work
        galleries = load_galleries_needing_cover(conn, BATCH_LIMIT)
        galleries_scanned = len(galleries)
        
        missing = sum(1 for g in galleries if g["cover_status"] == "missing")
        invalid = sum(1 for g in galleries if g["cover_status"] in ("cover_invalid", "cover_missing"))
        
        print(f"[gallery_cover_assignment] Galleries needing cover work: {galleries_scanned}")
        print(f"  - missing cover: {missing}")
        print(f"  - invalid cover: {invalid}")
        
        if galleries_scanned == 0:
            print("[gallery_cover_assignment] All galleries have valid covers. Done.")
            return
        
        gallery_ids = [g["id"] for g in galleries]
        
        # Step 2: Load cover candidates
        candidates = load_cover_candidates(conn, gallery_ids)
        print(f"[gallery_cover_assignment] Galleries with eligible candidates: {len(candidates)}")
        
        # Step 3: Score and prepare assignments
        assignments = []
        manual_review = []
        
        for gallery in galleries:
            gallery_candidates = candidates.get(gallery["id"], [])
            best = score_candidates(gallery_candidates)
            
            if best:
                assignments.append({
                    "gallery_id": gallery["id"],
                    "photo_id": best["photo_id"],
                    "slug": best["slug"],
                    "title": best["title"],
                    "score": best["score"],
                    "original_status": gallery["cover_status"],
                })
            else:
                manual_review.append({
                    "gallery_id": gallery["id"],
                    "reason": "no_eligible_photos",
                    "original_status": gallery["cover_status"],
                })
        
        print(f"[gallery_cover_assignment] Can assign: {len(assignments)}, Need manual: {len(manual_review)}")
        
        # Step 4: Assign/repair covers
        assigned, repaired = assign_or_repair_covers(conn, assignments)
        print(f"[gallery_cover_assignment] Covers assigned: {assigned}, Covers repaired: {repaired}")
        
        # Step 5: Queue manual review
        queued = queue_manual_review(conn, manual_review)
        print(f"[gallery_cover_assignment] Queued for manual review: {queued}")
        
        print(f"\n=== SUMMARY ===")
        print(f"galleries_scanned: {galleries_scanned}")
        print(f"covers_assigned: {assigned}")
        print(f"covers_repaired: {repaired}")
        print(f"manual_review_required: {queued}")
        
        # Sample output
        if assignments:
            print(f"\nSample assignments (first 5):")
            for item in assignments[:5]:
                print(f"  gallery {item['gallery_id']} ({item['original_status']}) -> photo {item['photo_id']} ({item['slug']}) | score={item['score']}")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
