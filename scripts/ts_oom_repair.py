#!/usr/bin/env python3
"""
WildPhotography Typesense OOM Repair Script
Repairs the 271 missing documents that caused OOM during reconcile.
Strategy: Individual upserts with 5-second delays after waiting for TS recovery.
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

def wait_for_ts(retry_count=0):
    """Wait for Typesense to recover from OOM state."""
    for i in range(12):  # up to 2 minutes
        health = check_ts_health()
        log(f"TS health check {i+1}: {health}")
        if health.get("ok") == True and "resource_error" not in health:
            log("Typesense recovered from OOM")
            return True
        time.sleep(10)
    log("Typesense still showing OUT_OF_MEMORY after 2 minutes")
    return False

def get_ts_doc_ids():
    """Export all doc IDs from the photos collection."""
    log("Exporting Typesense photo IDs...")
    ids = set()
    offset = 0
    page_size = 1000
    while True:
        try:
            r = requests.get(
                ts_url(f"/collections/{TS_COLL}/documents"),
                headers=ts_headers(),
                params={"limit": page_size, "offset": offset, "filter": ""},
                timeout=60
            )
            if r.status_code != 200:
                log(f"Export failed at offset {offset}: {r.status_code} {r.text}")
                break
            docs = r.json()
            if isinstance(docs, list):
                for d in docs:
                    if "id" in d:
                        ids.add(str(d["id"]))
                if len(docs) < page_size:
                    break
            else:
                break
            offset += page_size
        except Exception as e:
            log(f"Error exporting at offset {offset}: {e}")
            break
    log(f"Typesense has {len(ids)} photo document IDs")
    return ids

def get_missing_from_neon(ts_ids):
    """Query Neon for eligible photos not in Typesense."""
    log("Querying Neon for missing photos...")
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor()
    
    # Get all eligible photo IDs from Neon
    cur.execute("""
        SELECT p.id, p.slug, p.title, COALESCE(p.keywords, '{}'), 
               COALESCE(p.location_name, ''), COALESCE(p.region, ''), 
               COALESCE(p.country, ''), COALESCE(g.slug, '') as gallery_slug,
               p.url, p.thumb_url
        FROM photos p
        JOIN galleries g ON p.gallery_id = g.id
        WHERE p.search_ready = true 
          AND p.status = 'published'
          AND p.slug IS NOT NULL
          AND p.url IS NOT NULL
          AND p.thumb_url IS NOT NULL
        ORDER BY p.id
    """)
    
    missing = []
    for row in cur.fetchall():
        photo_id = str(row[0])
        if photo_id not in ts_ids:
            doc = {
                "id": photo_id,
                "slug": row[1] or "",
                "title": row[2] or "",
                "keywords": row[3] if isinstance(row[3], list) else [],
                "location": row[4],
                "region": row[5],
                "country": row[6],
                "gallery_slug": row[7],
                "url": row[8] or "",
                "thumb_url": row[9] or ""
            }
            missing.append(doc)
    
    cur.close()
    conn.close()
    log(f"Found {len(missing)} photos missing from Typesense")
    return missing

def upsert_doc(doc, retry_count=0):
    """Upsert a single document with backoff."""
    for attempt in range(5):
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
                err = r.json()
                if "OUT_OF_MEMORY" in r.text:
                    log(f"  Doc {doc['id']}: still OOM, attempt {attempt+1}/5")
                    time.sleep(30 * (attempt + 1))  # 30, 60, 90, 120, 150 seconds
                    continue
                else:
                    return {"ok": False, "id": doc["id"], "error": err.get("message", r.text)}
            else:
                return {"ok": False, "id": doc["id"], "error": f"HTTP {r.status_code}: {r.text}"}
        except Exception as e:
            log(f"  Doc {doc['id']}: exception {e}, attempt {attempt+1}/5")
            time.sleep(10 * (attempt + 1))
            continue
    return {"ok": False, "id": doc["id"], "error": "max retries exceeded"}

def main():
    log("=== Starting Typesense OOM Repair ===")
    
    # Step 1: Wait for TS to recover
    log("Step 1: Waiting for Typesense OOM recovery...")
    if not wait_for_ts():
        log("WARNING: Typesense still OOM, proceeding anyway with caution")
    time.sleep(10)  # Extra buffer after recovery
    
    # Step 2: Get current TS document IDs
    ts_ids = get_ts_doc_ids()
    
    # Step 3: Get missing from Neon
    missing_docs = get_missing_from_neon(ts_ids)
    log(f"Step 3: Will attempt to upsert {len(missing_docs)} documents")
    
    if not missing_docs:
        log("No missing documents — sync is healthy")
        return
    
    # Step 4: Upsert with delays
    success = 0
    failed = []
    for i, doc in enumerate(missing_docs):
        log(f"Upserting {i+1}/{len(missing_docs)}: id={doc['id']} slug={doc['slug']}")
        result = upsert_doc(doc)
        if result.get("ok"):
            success += 1
        else:
            failed.append(result)
        time.sleep(5)  # 5 second delay between each
    
    # Summary
    log(f"=== Repair Complete ===")
    log(f"Successful: {success}/{len(missing_docs)}")
    if failed:
        log(f"Failed: {len(failed)}")
        for f in failed:
            log(f"  FAILED id={f['id']}: {f['error']}")
    else:
        log("Zero failures — sync restored!")
    
    # Verify final count
    final_ids = get_ts_doc_ids()
    log(f"Final Typesense photo count: {len(final_ids)}")

if __name__ == "__main__":
    main()