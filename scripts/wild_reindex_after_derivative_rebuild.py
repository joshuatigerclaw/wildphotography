#!/usr/bin/env python3
"""WildPhotography Typesense reindex after derivative rebuild"""
import psycopg2, json, urllib.request, ssl

NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require'
TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net'
TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7'
COLLECTION = 'photos'

ctx = ssl.create_default_context()

def ts_req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        'https://' + TS_HOST + path,
        data=data, method=method,
        headers={'X-Typesense-Api-Key': TS_KEY, 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, context=ctx) as r:
        return json.loads(r.read())

conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()

# Get eligible DB records - only the 9 fields in the photos collection schema
cur.execute("""
    SELECT id, slug, title, description, gallery_slug, location_name, country, region, thumb_url, keywords
    FROM photos
    WHERE derivatives_complete = true
      AND ready_for_public_render = true
      AND search_ready = true
      AND slug IS NOT NULL AND slug != ''
      AND thumb_url IS NOT NULL AND thumb_url != ''
      AND thumb_url != 'pending'
    ORDER BY id
""")
rows = cur.fetchall()
conn.close()

eligible_ids = {str(r[0]) for r in rows}
print(f'Eligible DB records: {len(eligible_ids)}')

# Get current TS count
ts_info = ts_req('GET', f'/collections/{COLLECTION}')
ts_count = ts_info['num_documents']
print(f'Typesense docs before: {ts_count}')

# Get all TS doc IDs via export endpoint (streaming)
# FIX: Use include_fields=id to transfer only ~1 MB instead of ~60 MB per run.
ts_ids = set()
req = urllib.request.Request(
    'https://' + TS_HOST + f'/collections/{COLLECTION}/documents/export?include_fields=id',
    headers={'X-Typesense-Api-Key': TS_KEY}
)
with urllib.request.urlopen(req, context=ctx) as r:
    for line in r:
        line = line.strip()
        if not line:
            continue
        try:
            doc = json.loads(line)
            ts_ids.add(doc['id'])
        except json.JSONDecodeError:
            pass

print(f'TS doc IDs loaded: {len(ts_ids)}')

# Find missing (in DB eligible, not in TS)
missing = [r for r in rows if str(r[0]) not in ts_ids]
# Find stale (in TS, not in DB eligible)
stale = [doc_id for doc_id in ts_ids if doc_id not in eligible_ids]

print(f'Missing from TS (need upsert): {len(missing)}')
print(f'Stale in TS (need delete): {len(stale)}')

# Upsert missing - only schema fields: id, slug, title, description, gallery_slug, location_name, country, region, thumb_url, keywords
if missing:
    success = errors = 0
    for row in missing:
        doc = {
            'id': str(row[0]),
            'slug': row[1] or '',
            'title': row[2] or '',
            'description': row[3] or '',
            'gallery_slug': row[4] or '',
            'location_name': row[5] or '',
            'country': row[6] or '',
            'region': row[7] or '',
            'thumb_url': row[8] or '',
            'keywords': row[9] or ''
        }
        try:
            ts_req('POST', f'/collections/{COLLECTION}/documents', doc)
            success += 1
        except Exception as e:
            errors += 1
            print(f'  ERROR upserting {row[0]}: {str(e)[:80]}')
        if success % 50 == 0:
            print(f'  upserted {success}')
    print(f'Missing upserted: {success}, errors: {errors}')

# Delete stale
if stale:
    success = errors = 0
    for doc_id in stale:
        try:
            ts_req('DELETE', f'/collections/{COLLECTION}/documents/{doc_id}')
            success += 1
        except Exception as e:
            errors += 1
            print(f'  ERROR deleting {doc_id}: {str(e)[:80]}')
        if success % 50 == 0:
            print(f'  deleted {success}')
    print(f'Stale removed: {success}, errors: {errors}')

# Final count
ts_info = ts_req('GET', f'/collections/{COLLECTION}')
ts_count_after = ts_info['num_documents']
drift = ts_count_after - len(eligible_ids)
print(f'\nTypesense docs after: {ts_count_after}')
print(f'Eligible DB records:  {len(eligible_ids)}')
print(f'Final drift:          {drift}')
status = "SUCCESS - ALIGNED" if abs(drift) == 0 else f"DRIFT DETECTED ({drift})"
print(f'Status: {status}')