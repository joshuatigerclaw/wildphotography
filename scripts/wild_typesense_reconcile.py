#!/usr/bin/env python3
"""
WildPhotography Typesense Reconcile — ZERO LLM
Deterministic reconciliation between Neon DB and Typesense search index.
"""
import os
import sys
import json
import time
import datetime
from datetime import datetime as dt, timezone
import psycopg2
import requests

# ── Config ────────────────────────────────────────────────────────────────────
NEON_CONN = os.environ.get(
    "NEON_DATABASE_URL",
    "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
)
TS_HOST   = os.environ.get("TYPESENSE_HOST", "uibn03zvateqwdx2p-1.a1.typesense.net")
TS_KEY    = os.environ.get("TYPESENSE_API_KEY", "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7")
TS_PORT   = os.environ.get("TYPESENSE_PORT", "443")
TS_COLL   = "photos"
BATCH     = 200
LOG_DIR   = os.path.join(os.path.dirname(__file__), "..", "logs")

# ── Helpers ────────────────────────────────────────────────────────────────────
def ts_url(path):
    scheme = "https" if TS_PORT == "443" else "http"
    return f"{scheme}://{TS_HOST}:{TS_PORT}{path}"

def ts_headers():
    return {"X-Typesense-Api-Key": TS_KEY, "Content-Type": "application/json"}

def ts_get(path, params=None):
    r = requests.get(ts_url(path), headers=ts_headers(), params=params, timeout=30)
    return r

def ts_post(path, payload):
    r = requests.post(ts_url(path), headers=ts_headers(), data=json.dumps(payload), timeout=60)
    return r

def ts_delete(path):
    r = requests.delete(ts_url(path), headers=ts_headers(), timeout=30)
    return r

def log(msg):
    print(f"[reconcile] {msg}", flush=True)

# ── Eligibility query ──────────────────────────────────────────────────────────
ELIGIBILITY_SQL = """
SELECT
    p.id,
    p.slug,
    p.title,
    p.thumb_url,
    COALESCE(p.description, '')   AS description,
    COALESCE(p.keywords, '')       AS keywords,
    COALESCE(p.location_name, '')  AS location_name,
    COALESCE(p.country, '')        AS country,
    COALESCE(p.region, '')         AS region,
    COALESCE(p.gallery_slug, '')   AS gallery_slug,
    COALESCE(p.species_common_name, '') AS species_common_name,
    COALESCE(p.animal_group, '')   AS animal_group
FROM photos p
WHERE p.search_ready            = true
  AND p.ready_for_public_render = true
  AND p.derivatives_complete    = true
  AND p.thumb_url              IS NOT NULL
  AND p.thumb_url              <> ''
  AND p.slug                   IS NOT NULL
  AND p.slug                   <> ''
  AND (p.exclude_from_processing IS NULL OR p.exclude_from_processing = false)
ORDER BY p.id
LIMIT %s
"""

def get_eligible_ids(conn):
    """Return set of eligible photo ID strings."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM photos WHERE search_ready = true AND ready_for_public_render = true AND derivatives_complete = true AND thumb_url IS NOT NULL AND thumb_url <> '' AND slug IS NOT NULL AND slug <> '' AND (exclude_from_processing IS NULL OR exclude_from_processing = false)")
    total = cur.fetchone()[0]
    log(f"Eligible DB records (estimated): {total}")

    all_ids = set()
    cur.execute(ELIGIBILITY_SQL, (total + 1000,))
    rows = cur.fetchall()
    for row in rows:
        all_ids.add(str(row[0]))
    cur.close()
    log(f"Eligible DB IDs loaded: {len(all_ids)}")
    return all_ids

def get_eligible_records(conn, ids):
    """Return list of full record tuples for given ID set."""
    if not ids:
        return []
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
            COALESCE(EXTRACT(YEAR FROM p.date_taken)::int, 0) AS taken_year
        FROM photos p
        WHERE p.search_ready            = true
          AND p.ready_for_public_render = true
          AND p.derivatives_complete    = true
          AND p.thumb_url              IS NOT NULL AND p.thumb_url <> ''
          AND p.slug                   IS NOT NULL AND p.slug <> ''
          AND (p.exclude_from_processing IS NULL OR p.exclude_from_processing = false)
          AND CAST(p.id AS TEXT) IN ({placeholders})
        ORDER BY p.id
    """, id_tuple)
    rows = cur.fetchall()
    cur.close()
    return rows

def build_ts_doc(row):
    kw_raw = row[5]
    if isinstance(kw_raw, str):
        keywords = [k.strip() for k in kw_raw.split(",") if k.strip()] if kw_raw else []
    else:
        keywords = kw_raw or []
    return {
        "id":                     str(row[0]),
        "slug":                   row[1] or "",
        "title":                  row[2] or "",
        "thumb_url":              row[3] or "",
        "description":           row[4] or "",
        "keywords":               keywords,
        "location_name":          row[6] or "",
        "country":                row[7] or "",
        "region":                 row[8] or "",
        "gallery_slug":           row[9] or "",
        "species_common_name":   row[10] or "",
        "animal_group":          row[11] or "",
        "species_scientific_name": row[12] or "",
        "taken_timestamp":        row[13] or 0,
        "taken_year":             row[14] or 0,
    }

# ── Typesense export ───────────────────────────────────────────────────────────
def ts_export_ids():
    """Return set of all document IDs currently in Typesense."""
    log("Exporting Typesense document IDs…")
    url = f"/collections/{TS_COLL}/documents/export"
    r = ts_get(url, params={"filter": "", "include_fields": "id"})
    if r.status_code != 200:
        log(f"  Export failed: {r.status_code} {r.text[:200]}")
        return set()
    ids = set()
    for line in r.text.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        try:
            doc = json.loads(line)
            ids.add(str(doc.get("id", "")))
        except Exception:
            pass
    log(f"  Typesense IDs loaded: {len(ids)}")
    return ids

# ── Batch delete stale ─────────────────────────────────────────────────────────
def delete_stale(ids):
    log(f"Deleting {len(ids)} stale docs…")
    deleted = 0
    id_list = sorted(ids)
    for i in range(0, len(id_list), BATCH):
        batch = id_list[i:i+BATCH]
        url = f"/collections/{TS_COLL}/documents/{','.join(batch)}"
        r = ts_delete(url)
        # 200/204 = deleted; 404 = already gone (acceptable)
        if r.status_code in (200, 204):
            deleted += len(batch)
            log(f"  Deleted batch {i//BATCH + 1}: {len(batch)} docs OK")
        elif r.status_code == 404:
            # Count as deleted — stale doc was already removed
            deleted += len(batch)
            log(f"  Batch {i//BATCH + 1}: {len(batch)} docs — already gone (404)")
        else:
            log(f"  Delete batch {i//BATCH + 1}: HTTP {r.status_code} — {r.text[:100]}")
        time.sleep(0.2)
    return deleted

# ── Batch upsert missing ───────────────────────────────────────────────────────
def upsert_missing(conn, ids):
    log(f"Upserting {len(ids)} missing docs…")
    rows = get_eligible_records(conn, ids)
    log(f"  Fetched {len(rows)} full records from DB")
    indexed = 0
    failed = 0
    for i, row in enumerate(rows):
        doc = build_ts_doc(row)
        r = ts_post(f"/collections/{TS_COLL}/documents?action=upsert", doc)
        if r.status_code in (200, 201):
            indexed += 1
        else:
            failed += 1
            log(f"  Upsert doc {row[0]}: HTTP {r.status_code} — {r.text[:150]}")
        if (i + 1) % 50 == 0:
            log(f"  Progress: {i+1}/{len(rows)} upserted")
        time.sleep(0.1)
    if failed:
        log(f"  Completed: {indexed} upserted, {failed} failed")
    else:
        log(f"  Upserted {indexed} docs OK")
    return indexed

# ── Main ───────────────────────────────────────────────────────────────────────
def run():
    t0 = time.time()
    os.makedirs(LOG_DIR, exist_ok=True)
    log("Starting Typesense reconcile (ZERO LLM)")

    # 1. Connect to Neon
    try:
        conn = psycopg2.connect(NEON_CONN)
        log("Connected to Neon")
    except Exception as e:
        return {"status": "error", "error": str(e), "duration_seconds": time.time() - t0}

    try:
        # 2. Get eligible DB IDs
        db_ids = get_eligible_ids(conn)
        eligible_db_count = len(db_ids)

        # 3. Get Typesense IDs
        ts_ids = ts_export_ids()
        typesense_count_before = len(ts_ids)

        # 4. Compute diff
        stale_ids   = ts_ids - db_ids   # in TS, not in DB
        missing_ids = db_ids - ts_ids   # in DB, not in TS
        log(f"  Stale (TS only):   {len(stale_ids)}")
        log(f"  Missing (DB only): {len(missing_ids)}")

        # 5. Delete stale
        stale_removed = delete_stale(stale_ids) if stale_ids else 0

        # 6. Upsert missing
        missing_added = upsert_missing(conn, missing_ids) if missing_ids else 0

        # 7. Verify final state
        ts_ids_after = ts_export_ids()
        typesense_count_after = len(ts_ids_after)
        final_drift = abs(typesense_count_after - eligible_db_count)

        duration = time.time() - t0

        report = {
            "eligible_db_count":       eligible_db_count,
            "typesense_count_before":  typesense_count_before,
            "stale_removed":          stale_removed,
            "missing_added":          missing_added,
            "typesense_count_after":   typesense_count_after,
            "final_drift":             final_drift,
            "status":                 "success",
            "duration_seconds":       round(duration, 2),
            "timestamp":              dt.now(timezone.utc).isoformat(),
        }

    finally:
        conn.close()
        log("Neon connection closed")

    # 8. Save report
    ts = dt.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(LOG_DIR, f"typesense_reconcile_{ts}.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    log(f"Report saved: {report_path}")

    # Print summary
    print(json.dumps(report, indent=2))
    return report

if __name__ == "__main__":
    run()
