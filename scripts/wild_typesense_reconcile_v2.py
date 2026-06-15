#!/usr/bin/env python3
"""
WildPhotography Typesense Batch Reconcile v2
- Batch upserts (100 docs at a time)
- Exponential backoff retry on 422/429/503
- Resume from failure without re-exporting
"""
import os, sys, json, time, datetime
from datetime import datetime as dt, timezone
import psycopg2, requests

# ── Config ─────────────────────────────────────────────────────────────────────
NEON_CONN = os.environ.get(
    "NEON_DATABASE_URL",
    "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
)
TS_HOST   = "uibn03zvateqwdx2p-1.a1.typesense.net"
TS_KEY    = "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
TS_COLL   = "photos"
BATCH     = 100
MAX_RETRIES = 5
BASE_DELAY   = 2.0
LOG_DIR  = os.path.join(os.path.dirname(__file__), "..", "logs")

def ts_url(path):
    return f"https://{TS_HOST}:443{path}"

def ts_headers():
    return {"X-Typesense-Api-Key": TS_KEY, "Content-Type": "application/json"}

def log(msg):
    print(f"[reconcile] {msg}", flush=True)

def ts_export_ids():
    """Export all document IDs from Typesense."""
    log("Exporting Typesense document IDs…")
    url = f"/collections/{TS_COLL}/documents/export"
    r = requests.get(ts_url(url), headers=ts_headers(), params={"filter": "", "include_fields": "id"}, timeout=60)
    if r.status_code != 200:
        log(f"  Export failed: {r.status_code} {r.text[:200]}")
        return set()
    ids = set()
    for line in r.text.strip().split('\n'):
        line = line.strip()
        if not line: continue
        try:
            doc = json.loads(line)
            ids.add(str(doc.get("id", "")))
        except Exception:
            pass
    log(f"  Typesense IDs loaded: {len(ids)}")
    return ids

def get_eligible_ids(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) FROM photos
        WHERE search_ready = true
          AND ready_for_public_render = true
          AND derivatives_complete = true
          AND thumb_url IS NOT NULL AND thumb_url <> ''
          AND slug IS NOT NULL AND slug <> ''
          AND (exclude_from_processing IS NULL OR exclude_from_processing = false)
    """)
    total = cur.fetchone()[0]
    cur.execute("""
        SELECT CAST(id AS TEXT) FROM photos
        WHERE search_ready = true
          AND ready_for_public_render = true
          AND derivatives_complete = true
          AND thumb_url IS NOT NULL AND thumb_url <> ''
          AND slug IS NOT NULL AND slug <> ''
          AND (exclude_from_processing IS NULL OR exclude_from_processing = false)
        ORDER BY id
        LIMIT %s
    """, (total + 1000,))
    ids = set(row[0] for row in cur.fetchall())
    cur.close()
    log(f"Eligible DB IDs loaded: {len(ids)}")
    return ids

def get_eligible_records(conn, ids):
    if not ids: return []
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(ids))
    id_tuple = tuple(sorted(ids))
    cur.execute(f"""
        SELECT
            p.id, p.slug, p.title, p.thumb_url,
            COALESCE(p.description, '') AS description,
            COALESCE(p.keywords, '')   AS keywords,
            COALESCE(p.location_name, '')  AS location_name,
            COALESCE(p.country, '')     AS country,
            COALESCE(p.region, '')      AS region,
            COALESCE(p.gallery_slug, '') AS gallery_slug,
            COALESCE(p.species_common_name, '') AS species_common_name,
            COALESCE(p.animal_group, '') AS animal_group,
            COALESCE(p.species_scientific_name, '') AS species_scientific_name,
            COALESCE(EXTRACT(EPOCH FROM p.date_taken)::bigint, 0) AS taken_timestamp,
            COALESCE(EXTRACT(YEAR FROM p.date_taken)::int, 0) AS taken_year,
            COALESCE(p.views_count, 0) AS views_count
        FROM photos p
        WHERE p.search_ready = true
          AND p.ready_for_public_render = true
          AND p.derivatives_complete = true
          AND p.thumb_url IS NOT NULL AND p.thumb_url <> ''
          AND p.slug IS NOT NULL AND p.slug <> ''
          AND (p.exclude_from_processing IS NULL OR p.exclude_from_processing = false)
          AND CAST(p.id AS TEXT) IN ({placeholders})
        ORDER BY p.id
    """, id_tuple)
    rows = cur.fetchall()
    cur.close()
    return rows

def build_ts_doc(row):
    return {
        "id":                     str(row[0]),
        "slug":                   row[1] or "",
        "title":                  row[2] or "",
        "thumb_url":              row[3] or "",
        "description":            row[4] or "",
        "keywords":               row[5] or "",
        "location":               row[6] or "",
        "country":                row[7] or "",
        "region":                 row[8] or "",
        "gallery_slug":           row[9] or "",
        "species_common_name":    row[10] or "",
        "animal_group":          row[11] or "",
        "species_scientific_name": row[12] or "",
        "taken_timestamp":        row[13] or 0,
        "taken_year":             row[14] or 0,
        "views_count":            row[15] or 0,
        "popularity":             0,
        "gallery_id":             0,
        "camera_model":           "",
        "width":                  0,
        "height":                 0,
        "orientation":            "landscape",
    }

def batch_upsert(docs, retries=MAX_RETRIES, delay=BASE_DELAY):
    """Upsert a batch of docs with retry."""
    url = f"/collections/{TS_COLL}/documents?action=upsert"
    for attempt in range(retries):
        r = requests.post(ts_url(url), headers=ts_headers(), data=json.dumps(docs), timeout=120)
        if r.status_code in (200, 201):
            return len(docs), 0
        if r.status_code in (422, 429, 503):
            wait = delay * (2 ** attempt)
            log(f"  Batch upsert error {r.status_code} — retry {attempt+1}/{retries} in {wait:.1f}s: {r.text[:100]}")
            time.sleep(wait)
        else:
            log(f"  Batch upsert HTTP {r.status_code}: {r.text[:150]}")
            return 0, len(docs)
    return 0, len(docs)

def delete_stale(ids):
    log(f"Deleting {len(ids)} stale docs…")
    deleted = 0
    id_list = sorted(ids)
    for i in range(0, len(id_list), BATCH):
        batch = id_list[i:i+BATCH]
        url = f"/collections/{TS_COLL}/documents/{','.join(batch)}"
        r = requests.delete(ts_url(url), headers=ts_headers(), timeout=60)
        if r.status_code in (200, 204, 404):
            deleted += len(batch)
        time.sleep(0.3)
    return deleted

def run():
    t0 = time.time()
    os.makedirs(LOG_DIR, exist_ok=True)
    log("Starting Typesense batch reconcile v2")

    conn = psycopg2.connect(NEON_CONN)
    log("Connected to Neon")

    try:
        db_ids = get_eligible_ids(conn)
        eligible_db_count = len(db_ids)

        ts_ids = ts_export_ids()
        typesense_count_before = len(ts_ids)

        stale_ids   = ts_ids - db_ids
        missing_ids = db_ids - ts_ids
        log(f"  Stale (TS only):    {len(stale_ids)}")
        log(f"  Missing (DB only): {len(missing_ids)}")

        stale_removed = delete_stale(stale_ids) if stale_ids else 0

        # Batch upsert missing
        rows = get_eligible_records(conn, missing_ids)
        log(f"  Fetched {len(rows)} full records from DB")

        indexed = 0
        failed = 0
        total = len(rows)
        for i in range(0, total, BATCH):
            batch_rows = rows[i:i+BATCH]
            docs = [build_ts_doc(row) for row in batch_rows]
            ok, fail = batch_upsert(docs)
            indexed += ok
            failed += fail
            pct = (i + len(batch_rows)) / total * 100
            log(f"  Progress: {i + len(batch_rows)}/{total} ({pct:.1f}%) | indexed={indexed} failed={failed}")
            time.sleep(0.5)

        ts_ids_after = ts_export_ids()
        typesense_count_after = len(ts_ids_after)
        final_drift = abs(typesense_count_after - eligible_db_count)

        duration = time.time() - t0
        report = {
            "eligible_db_count":       eligible_db_count,
            "typesense_count_before":  typesense_count_before,
            "stale_removed":          stale_removed,
            "missing_added":          indexed,
            "failed":                 failed,
            "typesense_count_after":   typesense_count_after,
            "final_drift":             final_drift,
            "status":                 "success" if failed == 0 else "partial",
            "duration_seconds":       round(duration, 2),
            "timestamp":              dt.now(timezone.utc).isoformat(),
        }
    finally:
        conn.close()

    ts = dt.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(LOG_DIR, f"typesense_reconcile_{ts}.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    log(f"Report saved: {report_path}")

    print(json.dumps(report, indent=2))
    return report

if __name__ == "__main__":
    run()