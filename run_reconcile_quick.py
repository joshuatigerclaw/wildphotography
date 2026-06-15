#!/usr/bin/env python3
"""Quick Typesense reconciliation run"""
import os, sys, json, time, requests, psycopg2

NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
TS_HOST = "uibn03zvateqwdx2p-1.a1.typesense.net"
TS_KEY = "MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
TS_COLL = "photos"
BATCH = 200

def ts_url(path):
    return f"https://{TS_HOST}:443{path}"

def ts_headers():
    return {"X-Typesense-Api-Key": TS_KEY, "Content-Type": "application/json"}

conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()

# Get Typesense current count
r = requests.get(ts_url(f"/collections/{TS_COLL}/documents/search"), headers=ts_headers(), params={"q": "*", "limit": 0}, timeout=15)
ts_count = r.json()["found"]
print(f"Typesense docs: {ts_count}")

# Get DB eligible count
cur.execute("SELECT COUNT(*) FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')")
db_eligible = cur.fetchone()[0]
print(f"DB eligible: {db_eligible}")

drift = ts_count - db_eligible
print(f"Drift: {drift}")

# Reconcile: delete stale from Typesense where photo_id not in eligible set
if abs(drift) > 10:
    print("Running reconciliation...")
    cur.execute("SELECT id FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')")
    eligible_ids = set(str(row[0]) for row in cur.fetchall())
    
    r = requests.get(ts_url(f"/collections/{TS_COLL}/documents/export"), headers=ts_headers(), timeout=60)
    lines = r.text.strip().split('\n')
    to_delete = []
    for line in lines:
        try:
            doc = json.loads(line)
            pid = str(doc.get('id', ''))
            if pid and pid not in eligible_ids:
                to_delete.append(pid)
        except:
            pass
    
    print(f"Stale docs to remove from Typesense: {len(to_delete)}")
    deleted = 0
    for pid in to_delete[:500]:
        try:
            requests.delete(ts_url(f"/collections/{TS_COLL}/documents/{pid}"), headers=ts_headers(), timeout=5)
            deleted += 1
        except:
            pass
    print(f"Removed {deleted} stale docs")
else:
    print("Drift within tolerance, no reconcile needed")

cur.close()
conn.close()
print("Done")