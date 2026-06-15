#!/usr/bin/env python3
"""
WildPhotography Typesense OOM Repair Script v2
Repairs missing documents that caused OOM during reconcile.
Strategy: Wait for recovery, then individual upserts with 5s delay.
"""
import os
import sys
import json
import time
import datetime
import psycopg2
import requests

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
TS_HOST   = "uibn03zvateqwdx2p-1.a1.typesense.net"
TS_KEY    = "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
TS_PORT   = "443"
TS_COLL   = "photos"
LOG_PATH  = os.path.join(os.path.dirname(__file__), "..", "logs", "ts_repair_dispatch.log")

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[ts_repair] {ts} — {msg}"
    print(line)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")

def ts_url(path):
    return f"https://{TS_HOST}:{TS_PORT}{path}"

def ts_headers():
    return {"X-Typesense-Api-Key": TS_KEY, "Content-Type": "application/json"}

def check_ts_health():
    try:
        r = requests.get(ts_url("/health"), headers=ts_headers(), timeout=15)
        return r.json()
    except:
        return {"error": "unreachable"}

def wait_for_ts(max_wait=600):
    """Wait for Typesense to recover from OOM state."""
    log("Waiting for Typesense OOM recovery...")
    for i in range(max_wait // 10):
        health = check_ts_health()
        if health.get("ok") == True and "resource_error" not in health:
            log(f"Typesense recovered after ~{(i+1)*10}s")
            time.sleep(5)  # Extra buffer
            return True
        if i % 6 == 0:  # log every minute
            log(f"  Still OOM... {(i+1)*10}s elapsed, health={health}")
        time.sleep(10)
    log(f"Typesense still OOM after {max_wait}s — proceeding anyway")
    return False

def get_ts_count():
    """Get current document count from photos collection."""
    try:
        r = requests.get(ts_url(f"/collections/{TS_COLL}"), headers=ts_headers(), timeout=15)
        if r.status_code == 200:
            return r.json().get("num_documents", -1)
    except:
        pass
    return -1

def get_neon_eligible_ids():
    """Get all eligible photo IDs from Neon (those that should be in Typesense)."""
    log("Querying Neon for all eligible photo IDs...")
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT p.id
        FROM photos p
        WHERE p.search_ready = true 
          AND p.status = 'published'
          AND p.thumb_url IS NOT NULL
          AND p.slug IS NOT NULL
        ORDER BY p.id
    """)
    
    ids = [str(row[0]) for row in cur.fetchall()]
    cur.close()
    conn.close()
    log(f"Neon eligible photo IDs: {len(ids)}")
    return ids

def get_missing_ids():
    """Find which eligible photos are missing from Typesense."""
    log("Checking which eligible photos are missing from Typesense...")
    
    # Get TS count first
    ts_count = get_ts_count()
    log(f"Typesense current doc count: {ts_count}")
    
    if ts_count < 0:
        log("Cannot reach Typesense collection info — will attempt full repair based on Neon IDs")
        # Without TS access, we'll need to rebuild from scratch
        # For now, return the full list of eligible IDs so we can try individual upserts
        eligible = get_neon_eligible_ids()
        return eligible
    
    # Get all eligible IDs from Neon
    eligible = set(get_neon_eligible_ids())
    
    # Export all IDs currently in Typesense using scroll export
    ts_ids = set()
    try:
        # Use export endpoint which is lighter
        r = requests.get(ts_url(f"/collections/{TS_COLL}/documents?limit=0"), 
                        headers=ts_headers(), timeout=60)
        if r.status_code == 200:
            docs = r.json()
            if isinstance(docs, list):
                for d in docs:
                    if "id" in d:
                        ts_ids.add(str(d["id"]))
    except Exception as e:
        log(f"Could not export TS IDs: {e}")
    
    log(f"Typesense has {len(ts_ids)} IDs")
    
    # Missing = eligible not in TS
    missing = sorted([int(id) for id in eligible if str(id) not in ts_ids])
    log(f"Missing from Typesense: {len(missing)} docs")
    return [str(id) for id in missing]

def build_doc(photo_row):
    """Build a Typesense document from a Neon photo row."""
    return {
        "id": str(photo_row[0]),
        "slug": photo_row[1] or "",
        "title": photo_row[2] or "",
        "description": photo_row[3] or "",
        "keywords": photo_row[4] if isinstance(photo_row[4], list) else [],
        "location": photo_row[5] or "",
        "region": photo_row[6] or "",
        "country": photo_row[7] or "",
        "gallery_slug": photo_row[8] or "",
        "species": photo_row[9] or "",
        "url": photo_row[10] or "",
        "thumb_url": photo_row[11] or ""
    }

def get_photo_docs(photo_ids):
    """Fetch full records for given photo IDs from Neon."""
    if not photo_ids:
        return []
    
    log(f"Fetching {len(photo_ids)} full records from Neon...")
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor()
    
    placeholders = ",".join(["%s"] * len(photo_ids))
    sql = f"""
        SELECT p.id, p.slug, p.title, COALESCE(p.description_long, ''),
               p.subjects, COALESCE(p.location_name, ''), COALESCE(p.region, ''),
               COALESCE(p.country, ''), COALESCE(p.gallery_slug, ''),
               COALESCE(p.species_common_name, ''), p.thumb_url, p.thumb_url
        FROM photos p
        WHERE p.id IN ({placeholders})
    """
    
    cur.execute(sql, photo_ids)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    
    log(f"Fetched {len(rows)} records")
    return [build_doc(row) for row in rows]

def upsert_doc(doc, attempt=0):
    """Upsert a single document with backoff."""
    if attempt > 4:
        return {"ok": False, "id": doc["id"], "error": "max retries"}
    
    try:
        r = requests.post(
            ts_url(f"/collections/{TS_COLL}/documents"),
            headers=ts_headers(),
            data=json.dumps(doc),
            timeout=30
        )
        if r.status_code == 200:
            return {"ok": True, "id": doc["id"]}
        elif r.status_code == 422:
            if "OUT_OF_MEMORY" in r.text:
                wait = (attempt + 1) * 30
                log(f"  Doc {doc['id']}: OOM, waiting {wait}s before retry {attempt+1}/5")
                time.sleep(wait)
                return upsert_doc(doc, attempt + 1)
            else:
                return {"ok": False, "id": doc["id"], "error": r.text[:100]}
        else:
            return {"ok": False, "id": doc["id"], "error": f"HTTP {r.status_code}"}
    except Exception as e:
        log(f"  Doc {doc['id']}: exception {e}, retry {attempt+1}/5")
        time.sleep(10 * (attempt + 1))
        return upsert_doc(doc, attempt + 1)

def main():
    log("=== Starting Typesense OOM Repair v2 ===")
    
    # Step 1: Wait for TS recovery
    wait_for_ts(max_wait=600)
    
    # Step 2: Find missing IDs
    missing_ids = get_missing_ids()
    
    if not missing_ids:
        log("No missing documents — sync is healthy")
        return
    
    log(f"Will attempt to upsert {len(missing_ids)} documents")
    
    # Step 3: Get full records and upsert one at a time
    batch_size = 10
    for i in range(0, len(missing_ids), batch_size):
        batch = missing_ids[i:i+batch_size]
        docs = get_photo_docs(batch)
        
        for doc in docs:
            log(f"Upserting [{i+1}/{len(missing_ids)}]: id={doc['id']} slug={doc['slug'][:30]}")
            result = upsert_doc(doc)
            if result.get("ok"):
                log(f"  Success: {doc['id']}")
            else:
                log(f"  FAILED: {doc['id']} — {result['error']}")
            time.sleep(5)
    
    # Final check
    log("=== Final Status ===")
    ts_count = get_ts_count()
    log(f"Typesense photos collection count: {ts_count}")
    
    remaining_missing = get_missing_ids()
    if remaining_missing:
        log(f"WARNING: {len(remaining_missing)} docs still missing from TS")
        log(f"Still missing IDs: {remaining_missing[:20]}...")
    else:
        log("All eligible photos are now in Typesense — sync restored!")

if __name__ == "__main__":
    main()