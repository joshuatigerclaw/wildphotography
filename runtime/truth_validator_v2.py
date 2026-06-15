#!/usr/bin/env python3
"""
WildPhotography Truth Validator v2
Validates recently changed records for false positive readiness flags.
"""

import json
import datetime
import concurrent.futures
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import psycopg2
from psycopg2.extras import RealDictCursor

BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require"

REPORT_PATH = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/runtime/validation_v2_report.json"

# --- Helpers ---

def check_url(url, timeout=5):
    """Returns (ok, status_code)"""
    try:
        req = Request(url, headers={'User-Agent': BROWSER_UA})
        resp = urlopen(req, timeout=timeout)
        return True, resp.status
    except HTTPError as e:
        return False, e.code
    except URLError:
        return False, 0
    except Exception:
        return False, 0

def validate_record(record):
    """Validate a single record, return (failures, is_valid)"""
    failures = []
    r = record

    # thumb_url checks
    thumb = r.get("thumb_url")
    if not thumb:
        failures.append("missing_thumb_url")
    elif thumb:
        ok, code = check_url(thumb)
        if not ok:
            failures.append(f"broken_thumb_url_http_{code}")

    # required fields
    if not r.get("title"):
        failures.append("missing_title")
    if not r.get("slug"):
        failures.append("missing_slug")
    if not r.get("description"):
        failures.append("missing_description")
    if not r.get("keywords"):
        failures.append("missing_keywords")

    # derivatives_complete consistency: check if required derivative URLs are populated
    derivatives_complete = r.get("derivatives_complete", False)
    derivative_urls = [r.get("thumb_url"), r.get("small_url"), r.get("medium_url"), r.get("large_url"), r.get("preview_url")]
    has_derivatives = any(bool(u) for u in derivative_urls)
    if derivatives_complete and not has_derivatives:
        failures.append("derivatives_incomplete")

    # search_ready consistency: if record is marked search_ready but has critical failures, flag it
    search_ready = r.get("search_ready", False)
    critical_failures = [f for f in failures if f not in ("missing_keywords",)]
    if search_ready and len(critical_failures) > 0:
        failures.append("search_not_ready")

    is_valid = len(failures) == 0
    return failures, is_valid

# --- Main ---

def main():
    print("[TruthValidator] Starting validation scan...")

    report = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "total_recently_changed_checked": 0,
        "valid_remain_promoted": 0,
        "false_positives_demoted": 0,
        "failure_breakdown": {},
        "enqueued_for_repair": 0,
        "sample_broken_records": [],
        "records_changed": [],
    }

    # Connect to Neon
    conn = psycopg2.connect(NEON_CONN, cursor_factory=RealDictCursor)
    cur = conn.cursor()

    # Query recently changed records (last 7 days) with ready_for_public_render=True
    cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=7)).strftime("%Y-%m-%d")

    query = """
        SELECT
            id,
            title,
            slug,
            description,
            keywords,
            thumb_url,
            small_url,
            medium_url,
            large_url,
            preview_url,
            derivatives_complete,
            search_ready,
            ready_for_public_render,
            gallery_slug,
            date_modified,
            r2_thumb_key,
            r2_web_small_key,
            r2_web_large_key,
            r2_print_key,
            status
        FROM photos
        WHERE ready_for_public_render = true
          AND date_modified >= %s
        ORDER BY date_modified DESC
        LIMIT 500
    """

    cur.execute(query, (cutoff,))
    records = cur.fetchall()
    conn.close()

    report["total_recently_changed_checked"] = len(records)
    print(f"[TruthValidator] Found {len(records)} recently changed records with ready_for_public_render=true")

    broken_ids = []
    valid_ids = []

    # Validate concurrently
    def validate_wrapper(rec):
        failures, is_valid = validate_record(rec)
        return dict(rec), failures, is_valid

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(validate_wrapper, rec): rec for rec in records}
        for future in concurrent.futures.as_completed(futures):
            rec, failures, is_valid = future.result()
            rid = rec["id"]

            if is_valid:
                valid_ids.append(rid)
            else:
                broken_ids.append(rid)
                for f in failures:
                    report["failure_breakdown"][f] = report["failure_breakdown"].get(f, 0) + 1

                sample_entry = {
                    "id": rid,
                    "title": rec.get("title"),
                    "slug": rec.get("slug"),
                    "gallery_slug": rec.get("gallery_slug"),
                    "thumb_url": rec.get("thumb_url"),
                    "failures": failures,
                    "modified_at": str(rec.get("date_modified")),
                }
                if len(report["sample_broken_records"]) < 10:
                    report["sample_broken_records"].append(sample_entry)

    report["valid_remain_promoted"] = len(valid_ids)
    report["false_positives_demoted"] = len(broken_ids)
    report["enqueued_for_repair"] = len(broken_ids)

    print(f"[TruthValidator] Valid: {len(valid_ids)}, Broken (false positives): {len(broken_ids)}")
    print(f"[TruthValidator] Failure breakdown: {report['failure_breakdown']}")

    # Downgrade false positives in DB
    if broken_ids:
        print(f"[TruthValidator] Downgrading {len(broken_ids)} false positive records...")
        conn2 = psycopg2.connect(NEON_CONN)
        cur2 = conn2.cursor()

        placeholders = ",".join(["%s"] * len(broken_ids))
        update_sql = f"""
            UPDATE photos
            SET ready_for_public_render = false,
                search_ready = false,
                date_modified = NOW()
            WHERE id IN ({placeholders})
        """
        try:
            cur2.execute(update_sql, broken_ids)
            conn2.commit()
            report["records_changed"] = broken_ids
            print(f"[TruthValidator] Downgraded {cur2.rowcount} records.")
        except Exception as e:
            print(f"[TruthValidator] ERROR during downgrade: {e}")
            conn2.rollback()
        finally:
            cur2.close()
            conn2.close()

    # Write report
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)

    print(f"[TruthValidator] Report written to {REPORT_PATH}")
    print("[TruthValidator] Done.")

if __name__ == "__main__":
    main()