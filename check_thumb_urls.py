import os, psycopg2, urllib.request, urllib.error

conn = psycopg2.connect(os.environ.get(
    'NEON_CONNECTION_STRING',
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
))
cur = conn.cursor()

# Check thumb URL distribution
cur.execute('''
    SELECT 
        CASE 
            WHEN thumb_url LIKE '%%images.wildphoto%%' THEN 'images_wildphoto'
            WHEN thumb_url LIKE '%%r2.cloudflarestorage%%' THEN 'r2_cf'
            WHEN thumb_url LIKE '%%r2.dev%%' THEN 'r2_dev'
            WHEN thumb_url LIKE '%%cdn.statically%%' THEN 'cdn_statically'
            WHEN thumb_url IS NULL OR thumb_url = '' OR thumb_url = 'null' THEN 'NULL_EMPTY'
            ELSE 'other'
        END as url_type,
        COUNT(*) as cnt
    FROM photos 
    WHERE ready_for_public_render = true
    GROUP BY 1
    ORDER BY cnt DESC
''')
print("Thumb URL type distribution for render_ready photos:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Sample a few from each type and test
cur.execute('''
    SELECT id, thumb_url
    FROM photos 
    WHERE ready_for_public_render = true 
      AND thumb_url IS NOT NULL 
      AND thumb_url != '' 
      AND thumb_url != 'null'
    LIMIT 5
''')
rows = cur.fetchall()
print("\nSampling 5 render-ready thumb URLs:")
for row in rows:
    url = row[1]
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  [{row[0]}] {resp.status} - {url[:80]}")
    except Exception as e:
        print(f"  [{row[0]}] ERROR {type(e).__name__}: {e.reason if hasattr(e, 'reason') else str(e)} - {url[:80]}")
