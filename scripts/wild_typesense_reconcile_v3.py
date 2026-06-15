#!/usr/bin/env python3
"""
WildPhotography Typesense Reconcile — v3 (Optimized)
Uses Typesense /documents/DELETE?q=*&filter=id:[] for fast batch stale deletion.
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
TS_PORT   = "443"
TS_COLL   = "photos"
BATCH     = 200
LOG_DIR   = os.path.join(os.path.dirname(__file__), "..", "logs")

# ── Helpers ────────────────────────────────────────────────────────────────────
def ts_url(path):
    return f"https://{TS_HOST}:{TS_PORT}{path}"

def ts_headers():
    return {"X-Typesense-Api-Key": TS_KEY, "Content-Type": "application/json"}

def ts_get(path, params=None, timeout=30):
    r = requests.get(ts_url(path), headers=ts_headers(), params=params, timeout=timeout)
    return r

def ts_post(path, payload=None, retries=3, timeout=120):
    for attempt in range(retries):
        try:
            if payload is None:
                r = requests.post(ts_url(path), headers=ts_headers(), timeout=timeout)
            else:
                r = requests.post(ts_url(path), headers=ts_headers(), data=json.dumps(payload), timeout=timeout)
            return r
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt * 2)
            else:
                raise

def ts_delete_batch(ids, batch_size=500, retries=3):
    """Delete many IDs at once using filter-based multi-delete."""
    if not ids:
        return 0
    id_list = sorted(ids, key=lambda x: int(x) if str(x).isdigit() else float('inf'))
    total_deleted = 0
    total_batches = (len(id_list) + batch_size - 1) // batch_size
    for i, batch_start in enumerate(range(0, len(id_list), batch_size)):
        batch_ids = id_list[batch_start:batch_start + batch_size]
        # Build filter string: id:=[1,2,3]
        filter_str = "id:=[" + ",".join(str(x) for x in batch_ids) + "]"
        for attempt in range(retries):
            try:
                r = requests.delete(
                    ts_url(f"/collections/{TS_COLL}/documents"),
                    headers=ts_headers(),
                    params={"filter_by": filter_str, "q": "*"},
                    timeout=120
                )
                if r.status_code in (200, 201, 204):
                    # Parse response for count
                    try:
                        data = r.json()
                        deleted = data.get("num_deleted", len(batch_ids))
                    except Exception:
                        deleted = len(batch_ids)
                    total_deleted += deleted
                    break
                elif r.status_code == 404:
                    # Already gone
                    total_deleted += len(batch_ids)
                    break
                else:
                    if attempt < retries - 1:
                        time.sleep(2 ** attempt)
                    else:
                        raise Exception(f"HTTP {r.status_code}: {r.text[:200]}")
            except Exception as e:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise
        print(f"  Delete batch {i+1}/{total_batches}: {len(batch_ids)} IDs → status={r.status_code}", flush=True)
        time.sleep(0.15)
    return total_deleted

def log(msg):
    print(f"[reconcile] {msg}", flush=True)

# ── Eligibility query ──────────────────────────────────────────────────────────
ELIGIBILITY_SQL = """
SELECT COUNT(*) FROM photos p
WHERE p.search_ready            = true
  AND p.ready_for_public_render = true
  AND p.derivatives_complete    = true
  AND p.thumb_url              IS NOT NULL AND p.thumb_url <> ''
  AND p.slug                   IS NOT NULL AND p.slug <> ''
  AND (p.exclude_from_processing IS NULL OR p.exclude_from_processing = false)
"""

def get_eligible_ids(conn):
    cur = conn.cursor()
    cur.execute(ELIGIBILITY_SQL)
    total = cur.fetchone()[0]
    log(f"Eligible DB records (estimated): {total}")
    cur.execute("""
        SELECT CAST(p.id AS TEXT)
        FROM photos p
        WHERE p.search_ready            = true
          AND p.ready_for_public_render = true
          AND p.derivatives_complete    = true
          AND p.thumb_url              IS NOT NULL AND p.thumb_url <> ''
          AND p.slug                   IS NOT NULL AND p.slug <> ''
          AND (p.exclude_from_processing IS NULL OR p.exclude_from_processing = false)
        ORDER BY p.id
    """)
    all_ids = set(row[0] for row in cur.fetchall())
    cur.close()
    log(f"Eligible DB IDs loaded: {len(all_ids)}")
    return all_ids

def get_eligible_records(conn, ids):
    if not ids:
        return []
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(ids))
    id_tuple = tuple(sorted(ids, key=lambda x: int(x) if str(x).isdigit() else float('inf')))
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
    keywords_val = kw_raw if isinstance(kw_raw, str) else str(kw_raw) if kw_raw else ""
    return {
        "id":                      str(row[0]),
        "slug":                    row[1] or "",
        "title":                   row[2] or "",
        "thumb_url":               row[3] or "",
        "description":             row[4] or "",
        "keywords":                keywords_val,
        "location":                row[6] or "",
        "country":                 row[7] or "",
        "region":                  row[8] or "",
        "gallery_slug":            row[9] or "",
        "species_common_name":     row[10] or "",
        "animal_group":            row[11] or "",
        "species_scientific_name": row[12] or "",
        "taken_timestamp":         row[13] or 0,
        "taken_year":              row[14] or 0,
        "views_count":             row[15] or 0,
        "popularity":              0,
        "gallery_id":              0,
        "camera_model":            "",
        "width":                   0,
        "height":                  0,
        "orientation":             "landscape",
        "date_taken":              row[14] or 0,
    }

# ── Typesense export ───────────────────────────────────────────────────────────
def ts_export_ids():
    log("Exporting Typesense document IDs…")
    url = f"/collections/{TS_COLL}/documents/export"
    r = ts_get(url, params={"filter": "", "include_fields": "id"}, timeout=120)
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

# ── Batch upsert missing ───────────────────────────────────────────────────────
def upsert_missing(conn, ids):
    log(f"Upserting {len(ids)} missing docs in batches...")
    rows = get_eligible_records(conn, ids)
    log(f"  Fetched {len(rows)} full records from DB")
    indexed = 0
    failed = 0
    BATCH_SIZE = 200
    for batch_start in range(0, len(rows), BATCH_SIZE):
        batch_rows = rows[batch_start:batch_start + BATCH_SIZE]
        docs = [build_ts_doc(row) for row in batch_rows]
        r = ts_post(f"/collections/{TS_COLL}/documents?action=upsert", docs, timeout=120)
        if r.status_code in (200, 201):
            indexed += len(docs)
            log(f"  Batch {batch_start//BATCH_SIZE + 1}: {len(docs)} upserted OK")
        else:
            log(f"  Batch upsert failed HTTP {r.status_code}: {r.text[:100]}, falling back to individual")
            sub_indexed, sub_failed = _upsert_individual_with_retry(batch_rows)
            indexed += sub_indexed
            failed += sub_failed
            log(f"  Individual fallback: {sub_indexed} ok, {sub_failed} failed")
        time.sleep(0.2)
    log(f"Upserted {indexed} docs, {failed} failed")
    return indexed, failed

def _upsert_individual_with_retry(rows, retries=2, batch=50):
    indexed = 0
    failed = 0
    for i, row in enumerate(rows):
        doc = build_ts_doc(row)
        for attempt in range(retries):
            r = ts_post(f"/collections/{TS_COLL}/documents?action=upsert", doc, timeout=30)
            if r.status_code in (200, 201):
                break
            if r.status_code not in (408, 429, 500, 502, 503, 422):
                break
            time.sleep(2 ** attempt)
        if r.status_code in (200, 201):
            indexed += 1
        else:
            failed += 1
            log(f"  Upsert doc {row[0]}: HTTP {r.status_code} — {r.text[:120]}")
        if (i + 1) % 50 == 0:
            log(f"  Progress: {i+1}/{len(rows)} upserted")
        time.sleep(0.05)
    return indexed, failed

# ── Main ───────────────────────────────────────────────────────────────────────
def run():
    t0 = time.time()
    os.makedirs(LOG_DIR, exist_ok=True)
    log("Starting Typesense reconcile v3 (Optimized)")

    try:
        conn = psycopg2.connect(NEON_CONN)
        log("Connected to Neon")
    except Exception as e:
        return {"status": "error", "error": str(e), "duration_seconds": time.time() - t0}

    try:
        db_ids = get_eligible_ids(conn)
        eligible_db_count = len(db_ids)

        ts_ids = ts_export_ids()
        typesense_count_before = len(ts_ids)

        stale_ids   = ts_ids - db_ids
        missing_ids = db_ids - ts_ids
        log(f"  Stale (TS only):   {len(stale_ids)}")
        log(f"  Missing (DB only): {len(missing_ids)}")

        stale_removed = 0
        if stale_ids:
            try:
                stale_removed = ts_delete_batch(list(stale_ids), batch_size=500)
            except Exception as e:
                log(f"  Batch delete failed: {e}, trying individual fallback")
                individual_deleted = 0
                for sid in list(stale_ids)[:2000]:  # cap to avoid timeout
                    try:
                        r = requests.delete(
                            ts_url(f"/collections/{TS_COLL}/documents/{sid}"),
                            headers=ts_headers(), timeout=10
                        )
                        if r.status_code in (200, 204, 404):
                            individual_deleted += 1
                    except Exception:
                        pass
                stale_removed = individual_deleted
                log(f"  Individual fallback deleted {individual_deleted}")

        missing_added = 0
        failed = 0
        if missing_ids:
            missing_added, failed = upsert_missing(conn, missing_ids)

        ts_ids_after = ts_export_ids()
        typesense_count_after = len(ts_ids_after)
        final_drift = abs(typesense_count_after - eligible_db_count)

        duration = time.time() - t0

        report = {
            "eligible_db_count":       eligible_db_count,
            "typesense_count_before":  typesense_count_before,
            "stale_removed":           stale_removed,
            "missing_added":           missing_added,
            "failed":                  failed,
            "typesense_count_after":    typesense_count_after,
            "final_drift":             final_drift,
            "status":                  "success",
            "duration_seconds":        round(duration, 2),
            "timestamp":               dt.now(timezone.utc).isoformat(),
        }

    finally:
        conn.close()
        log("Neon connection closed")

    ts = dt.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(LOG_DIR, f"typesense_reconcile_{ts}.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    log(f"Report saved: {report_path}")

    print(json.dumps(report, indent=2))
    return report

if __name__ == "__main__":
    run()
