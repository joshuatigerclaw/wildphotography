import os, psycopg2
conn = psycopg2.connect(os.environ.get(
    'NEON_CONNECTION_STRING',
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
))
cur = conn.cursor()

# Count photos by thumb_url type (all photos)
cur.execute("""
    SELECT 
        CASE 
            WHEN thumb_url LIKE '%%r2.cloudflarestorage%%' THEN 'r2_cloudflarestorage_bad'
            WHEN thumb_url LIKE '%%r2.dev%%' THEN 'r2_dev_missing_bucket'
            WHEN thumb_url LIKE '%%images.wildphotography%%' THEN 'images_cdn_working'
            WHEN thumb_url LIKE '%%cdn.statically%%' THEN 'cdn_statically'
            WHEN thumb_url IS NULL OR thumb_url = '' OR thumb_url = 'null' THEN 'NULL_EMPTY'
            ELSE 'other'
        END as url_type,
        COUNT(*) as cnt
    FROM photos 
    GROUP BY 1
    ORDER BY cnt DESC
""")
print("ALL photos thumb_url type distribution:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Count render_ready photos with each URL type
for type_name, condition in [
    ("r2_cloudflarestorage", "thumb_url LIKE '%%r2.cloudflarestorage%%'"),
    ("r2_dev", "thumb_url LIKE '%%r2.dev%%'"),
    ("images_cdn", "thumb_url LIKE '%%images.wildphotography%%'"),
]:
    cur.execute(f"""
        SELECT COUNT(*) FROM photos 
        WHERE ready_for_public_render = true 
        AND {condition}
    """)
    print(f"Render-ready with {type_name}: {cur.fetchone()[0]}")

# Show sample of broken r2.cloudflarestorage records
cur.execute("""
    SELECT id, slug, thumb_url, derivatives_complete, ready_for_public_render
    FROM photos
    WHERE thumb_url LIKE '%%r2.cloudflarestorage%%'
    LIMIT 3
""")
print("\nSample r2.cloudflarestorage records:")
for row in cur.fetchall():
    print(f"  id={row[0]} slug={row[1]} deriv={row[3]} render={row[4]}")
    print(f"    {row[2][:100]}")
