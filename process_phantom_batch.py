#!/usr/bin/env python3
"""
WildPhotography Phantom Derivative Repair Agent
Processes derivative_repair_queue.json records with reason=phantom_complete_flag.
"""

import json
import os
import time
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, EndpointConnectionError
import psycopg2
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─── Config ────────────────────────────────────────────────────────────────────
QUEUE_PATH = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/derivative_repair_queue.json"
REPORT_PATH = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/repair_batch_20260322.json"

R2_ENDPOINT  = "https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
R2_BUCKET    = "wildphoto-storage"
R2_ACCESS_KEY = "b821d56d29d9a2c716f783fc481e2f75"
R2_SECRET_KEY = "3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"

DB_URL = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

BATCH_SIZE = 100
REPORT_EVERY = 100
MAX_WORKERS = 20  # R2 concurrent checks

# ─── R2 Client ─────────────────────────────────────────────────────────────────
r2_config = Config(
    region_name="auto",
    retries={"max_attempts": 3, "mode": "standard"},
    signature_version="s3v4",
)

def make_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        config=r2_config,
    )

# ─── R2 Check: does derivatives/{id}/ prefix have any objects? ────────────────
def r2_has_derivatives(photo_id: int) -> bool:
    prefix = f"derivatives/{photo_id}/"
    try:
        client = make_r2_client()
        resp = client.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix, MaxKeys=1)
        return "Contents" in resp and len(resp["Contents"]) > 0
    except (ClientError, EndpointConnectionError) as e:
        print(f"\n  [R2 ERROR] id={photo_id}: {e}")
        return None  # Unknown — don't change

# ─── DB Connection ─────────────────────────────────────────────────────────────
def get_db_conn():
    return psycopg2.connect(DB_URL)

# ─── Process a batch of IDs ────────────────────────────────────────────────────
def process_batch(batch_ids: list, thread_pool: ThreadPoolExecutor) -> dict:
    """
    Check R2 for each ID in batch concurrently, return results.
    """
    results = {"confirmed": [], "missing": [], "error": []}
    futures = {}
    
    for pid in batch_ids:
        futures[pid] = thread_pool.submit(r2_has_derivatives, pid)
    
    for pid, future in futures.items():
        try:
            status = future.result(timeout=15)
            if status is True:
                results["confirmed"].append(pid)
            elif status is False:
                results["missing"].append(pid)
            else:
                results["error"].append(pid)
        except Exception as e:
            print(f"\n  [FUTURE ERROR] id={pid}: {e}")
            results["error"].append(pid)
    
    return results

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    # Load queue
    with open(QUEUE_PATH) as f:
        queue_data = json.load(f)
    
    phantom_records = [
        r for r in queue_data["queue"]
        if r.get("reason") == "phantom_complete_flag"
    ]
    total = len(phantom_records)
    print(f"Total phantom_complete_flag records: {total}")
    
    ids_all = [r["id"] for r in phantom_records]
    
    # Stats
    total_processed = 0
    confirmed_fixed = []
    missing_flagged = []
    errors = []
    
    conn = get_db_conn()
    
    # Thread pool for concurrent R2 checks
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        # Process in batches
        for batch_start in range(0, total, BATCH_SIZE):
            batch_ids = ids_all[batch_start : batch_start + BATCH_SIZE]
            batch_num = batch_start // BATCH_SIZE + 1
            total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
            
            print(f"\nBatch {batch_num}/{total_batches} — IDs {batch_ids[0]}–{batch_ids[-1]} ({len(batch_ids)} records)", end="", flush=True)
            
            try:
                result = process_batch(batch_ids, pool)
                confirmed_fixed.extend(result["confirmed"])
                missing_flagged.extend(result["missing"])
                errors.extend(result["error"])
                total_processed += len(batch_ids)
                
                # DB update after each batch
                if result["confirmed"]:
                    ids_conf = ",".join(str(i) for i in result["confirmed"])
                    with conn.cursor() as cur:
                        cur.execute(
                            f"UPDATE photos SET derivatives_complete=true, ready_for_public_render=true "
                            f"WHERE id IN ({ids_conf})"
                        )
                        updated = cur.rowcount
                    conn.commit()
                    print(f" | confirmed={len(result['confirmed'])} (db updated {updated})", end="")
                
                if result["missing"]:
                    ids_miss = ",".join(str(i) for i in result["missing"])
                    with conn.cursor() as cur:
                        cur.execute(
                            f"UPDATE photos SET derivatives_complete=false, ready_for_public_render=false "
                            f"WHERE id IN ({ids_miss})"
                        )
                        updated = cur.rowcount
                    conn.commit()
                    print(f" | missing={len(result['missing'])} (db updated {updated})", end="")
                
            except Exception as e:
                print(f"\n  [BATCH ERROR] {e}")
                errors.extend(batch_ids)
                total_processed += len(batch_ids)
            
            if total_processed % REPORT_EVERY == 0 or total_processed == total:
                print(f"\n  Cumulative: confirmed={len(confirmed_fixed)}, missing={len(missing_flagged)}, errors={len(errors)}")
    
    conn.close()
    
    # Build report
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "records_processed": total_processed,
        "derivatives_confirmed_and_fixed": {
            "count": len(confirmed_fixed),
            "ids": confirmed_fixed
        },
        "derivatives_missing_and_flagged": {
            "count": len(missing_flagged),
            "ids": missing_flagged
        },
        "errors": {
            "count": len(errors),
            "ids": errors
        }
    }
    
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\n✅ Done! Report saved to {REPORT_PATH}")
    print(f"   Processed: {total_processed}")
    print(f"   Confirmed fixed (phantom→real): {len(confirmed_fixed)}")
    print(f"   Missing flagged (phantom→broken): {len(missing_flagged)}")
    print(f"   Errors: {len(errors)}")

if __name__ == "__main__":
    main()
