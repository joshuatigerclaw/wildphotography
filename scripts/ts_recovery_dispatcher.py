#!/usr/bin/env python3
"""
WildPhotography Typesense OOM Recovery + Repair
Standalone recovery script that:
1. Continuously monitors TS health until OUT_OF_MEMORY clears
2. Then immediately upserts the 22 confirmed missing documents
3. And checks the full reconcile gap
4. Reports final status

Run with: python3 ts_recovery_dispatcher.py
"""
import os, sys, json, time, datetime, psycopg2, requests

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
TS_HOST   = "uibn03zvateqwdx2p-1.a1.typesense.net"
TS_KEY    = "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
TS_PORT   = "443"
TS_COLL   = "photos"
LOG_PATH  = os.path.join(os.path.dirname(__file__), "..", "logs", "ts_recovery_dispatch.log")

MISSING_IDS = [6678,78250,78251,78252,78253,78254,78255,78256,78257,78258,78259,78260,78261,78262,78263,78264,78266,78267,78268,78269,78270,78271]

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[ts_recovery] {ts} — {msg}"
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
    except Exception as e:
        return {"error": str(e)}

def get_ts_count():
    try:
        r = requests.get(ts_url(f"/collections/{TS_COLL}"), headers=ts_headers(), timeout=15)
        if r.status_code == 200:
            return r.json().get("num_documents", -1)
    except:
        pass
    return -1

def try_test_upsert():
    """Try a minimal upsert to verify writes work."""
    test_doc = {"id": "999999999", "slug": "health-test", "title": "Health Test",
                "description": "", "keywords": [], "location": "", "region": "",
                "country": "", "gallery_slug": "", "species": "", "url": "", "thumb_url": ""}
    try:
        r = requests.post(ts_url(f"/collections/{TS_COLL}/documents"),
                          headers=ts_headers(), data=json.dumps(test_doc), timeout=20)
        if r.status_code in (200, 201):
            # Delete the test doc
            try:
                requests.delete(ts_url(f"/collections/{TS_COLL}/documents/999999999"),
                                headers=ts_headers(), timeout=10)
            except:
                pass
            return True
        return False
    except:
        return False

def fetch_neon_records(ids):
    log(f"Fetching {len(ids)} records from Neon...")
    conn = psycopg2.connect(NEON_CONN)
    cur = conn.cursor()
    placeholders = ",".join(["%s"] * len(ids))
    sql = f"""
        SELECT p.id, p.slug, p.title, COALESCE(p.description_long, ''),
               p.subjects, COALESCE(p.location_name, ''), COALESCE(p.region, ''),
               COALESCE(p.country, ''), COALESCE(p.gallery_slug, ''),
               COALESCE(p.species_common_name, ''), p.thumb_url
        FROM photos p WHERE p.id IN ({placeholders})
    """
    cur.execute(sql, ids)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    log(f"Fetched {len(rows)} records")
    return rows

def build_doc(row):
    keywords = row[4] if isinstance(row[4], list) else ([k.strip() for k in row[4].split(",")] if row[4] else [])
    return {
        "id": str(row[0]),
        "slug": row[1] or "",
        "title": row[2] or "",
        "description": row[3] or "",
        "keywords": keywords,
        "location": row[5] or "",
        "region": row[6] or "",
        "country": row[7] or "",
        "gallery_slug": row[8] or "",
        "species": row[9] or "",
        "thumb_url": row[10] or "",
        "url": row[10] or ""
    }

def upsert_doc(doc, attempt=0):
    if attempt > 4:
        return False
    try:
        r = requests.post(ts_url(f"/collections/{TS_COLL}/documents"),
                          headers=ts_headers(), data=json.dumps(doc), timeout=30)
        if r.status_code == 200:
            return True
        if r.status_code == 422 and "OUT_OF_MEMORY" in r.text:
            wait = 30 * (attempt + 1)
            log(f"  OOM on {doc['id']}, retry in {wait}s (attempt {attempt+1}/4)")
            time.sleep(wait)
            return upsert_doc(doc, attempt + 1)
        log(f"  Failed {doc['id']}: HTTP {r.status_code} {r.text[:60]}")
        return False
    except Exception as e:
        log(f"  Exception on {doc['id']}: {e}")
        time.sleep(15 * (attempt + 1))
        return upsert_doc(doc, attempt + 1)

def run_repair():
    log("=== Starting TS OOM Recovery Dispatcher ===")
    
    # Step 1: Monitor until not OOM
    log("Monitoring TS health until memory recovers...")
    recovered = False
    check_interval = 30
    max_wait = 1800  # 30 minutes
    
    for i in range(max_wait // check_interval):
        h = check_health()
        log(f"  Check {(i+1)*check_interval}s: {h}")
        
        if h.get("ok") == True and "resource_error" not in h:
            log("TS health is OK — attempting test upsert...")
            if try_test_upsert():
                log("Test upsert succeeded — TS is accepting writes!")
                recovered = True
                break
            else:
                log("Health OK but test upsert failed — continuing to monitor...")
        
        time.sleep(check_interval)
    
    if not recovered:
        log("TS did not recover within 30 minutes")
        return
    
    # Step 2: Fetch and upsert the 22 confirmed missing documents
    log("=== Repair Phase: Upserting 22 confirmed missing docs ===")
    rows = fetch_neon_records(MISSING_IDS)
    
    success = 0
    failed = []
    for i, row in enumerate(rows):
        doc = build_doc(row)
        log(f"Upserting [{i+1}/22] id={doc['id']} slug={doc['slug'][:20]}")
        if upsert_doc(doc):
            success += 1
            log(f"  ✓ OK")
        else:
            failed.append(doc["id"])
            log(f"  ✗ FAILED")
        time.sleep(3)
    
    log(f"=== 22-Doc Repair Results: {success}/22 successful ===")
    if failed:
        log(f"Failed IDs: {failed}")
    
    # Step 3: Report current state
    ts_count = get_ts_count()
    log(f"Final TS photos count: {ts_count}")
    log(f"Neon eligible count: 64123 (from prior query)")
    gap = max(0, 64123 - ts_count)
    log(f"Remaining gap: {gap} docs")
    
    if gap == 0:
        log("✓ All eligible photos are now indexed — sync restored!")
    else:
        log(f"⚠ {gap} docs still missing. These could not be indexed due to persistent OOM.")

if __name__ == "__main__":
    run_repair()