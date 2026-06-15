#!/usr/bin/env python3
"""
WildPhotography Typesense OOM Repair Script v3
Focused repair: waits for OOM to clear, then upserts the 22 confirmed missing IDs
with conservative timing.
"""
import os, sys, json, time, datetime, psycopg2, requests

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
TS_HOST   = "uibn03zvateqwdx2p-1.a1.typesense.net"
TS_KEY    = "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
TS_PORT   = "443"
TS_COLL   = "photos"
LOG_PATH  = os.path.join(os.path.dirname(__file__), "..", "logs", "ts_repair_dispatch.log")

# 22 IDs confirmed missing from reconcile log
MISSING_IDS = ['6678','78250','78251','78252','78253','78254','78255',
               '78256','78257','78258','78259','78260','78261','78262',
               '78263','78264','78266','78267','78268','78269','78270','78271']

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

def check_health():
    try:
        r = requests.get(ts_url("/health"), headers=ts_headers(), timeout=15)
        return r.json()
    except:
        return {"error": "unreachable"}

def wait_for_recovery(max_wait=900):
    log(f"Waiting up to {max_wait}s for Typesense OOM recovery...")
    for i in range(max_wait // 15):
        h = check_health()
        if h.get("ok") == True and "resource_error" not in h:
            log(f"TS recovered after {(i+1)*15}s")
            time.sleep(10)
            return True
        if i % 4 == 0:
            log(f"  Still OOM... {(i+1)*15}s elapsed, health={h}")
        time.sleep(15)
    log("Timeout waiting for TS recovery")
    return False

def fetch_neon_photos(ids):
    log(f"Fetching {len(ids)} records from Neon...")
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor()
    placeholders = ",".join(["%s"] * len(ids))
    sql = f"""
        SELECT p.id, p.slug, p.title, COALESCE(p.description_long, ''),
               p.subjects, COALESCE(p.location_name, ''), COALESCE(p.region, ''),
               COALESCE(p.country, ''), COALESCE(p.gallery_slug, ''),
               COALESCE(p.species_common_name, ''), p.thumb_url
        FROM photos p
        WHERE p.id IN ({placeholders})
    """
    cur.execute(sql, ids)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    log(f"Fetched {len(rows)} records")
    return rows

def build_doc(row):
    keywords = row[4] if isinstance(row[4], list) else (row[4].split(",") if row[4] else [])
    return {
        "id": str(row[0]),
        "slug": row[1] or "",
        "title": row[2] or "",
        "description": row[3] or "",
        "keywords": [k.strip() for k in keywords if k.strip()],
        "location": row[5] or "",
        "region": row[6] or "",
        "country": row[7] or "",
        "gallery_slug": row[8] or "",
        "species": row[9] or "",
        "thumb_url": row[10] or "",
        "url": row[10] or ""   # use thumb_url as url since no url field
    }

def upsert_one(doc, attempt=0):
    if attempt > 6:
        return False
    try:
        r = requests.post(
            ts_url(f"/collections/{TS_COLL}/documents"),
            headers=ts_headers(),
            data=json.dumps(doc),
            timeout=30
        )
        if r.status_code == 200:
            return True
        if r.status_code == 422:
            if "OUT_OF_MEMORY" in r.text:
                wait = 30 * (attempt + 1)
                log(f"    OOM on {doc['id']}, waiting {wait}s before retry {attempt+1}/6")
                time.sleep(wait)
                return upsert_one(doc, attempt + 1)
            else:
                log(f"    HTTP 422 non-OOM on {doc['id']}: {r.text[:80]}")
                return False
        log(f"    HTTP {r.status_code} on {doc['id']}: {r.text[:80]}")
        return False
    except Exception as e:
        log(f"    Exception on {doc['id']}: {e}, retry {attempt+1}/6")
        time.sleep(15 * (attempt + 1))
        return upsert_one(doc, attempt + 1)

def main():
    log("=== Starting Typesense OOM Repair v3 ===")
    
    # Step 1: Wait for recovery
    wait_for_recovery()
    
    # Step 2: Fetch records from Neon
    rows = fetch_neon_photos([int(i) for i in MISSING_IDS])
    
    if not rows:
        log("ERROR: No records fetched from Neon for missing IDs!")
        return
    
    log(f"Will upsert {len(rows)} documents")
    
    # Step 3: Upsert one at a time with 5s gap
    success = 0
    failed = []
    for i, row in enumerate(rows):
        doc = build_doc(row)
        log(f"Upserting [{i+1}/{len(rows)}] id={doc['id']} slug={doc['slug'][:25]}")
        ok = upsert_one(doc)
        if ok:
            success += 1
            log(f"  ✓ Success")
        else:
            failed.append(doc["id"])
            log(f"  ✗ FAILED")
        time.sleep(5)
    
    # Step 4: Report
    log("=== Repair Results ===")
    log(f"Successful: {success}/{len(rows)}")
    log(f"Failed: {len(failed)}")
    if failed:
        log(f"Failed IDs: {failed}")
    
    # Step 5: Final health + collection count
    h = check_health()
    log(f"Final TS health: {h}")
    try:
        r = requests.get(ts_url(f"/collections/{TS_COLL}"), headers=ts_headers(), timeout=15)
        if r.status_code == 200:
            log(f"Final TS doc count: {r.json().get('num_documents')}")
    except:
        log("Could not get final TS count")

if __name__ == "__main__":
    main()