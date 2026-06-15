import psycopg2, os, signal, sys

def handler(signum, frame):
    print('TIMEOUT after 30s', file=sys.stderr)
    sys.exit(1)

signal.signal(signal.SIGALRM, handler)
signal.alarm(30)

NEON_CONN = os.environ.get(
    "NEON_DATABASE_URL",
    "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
)
conn = psycopg2.connect(NEON_CONN)
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
print('count:', cur.fetchone()[0])
cur.close()
conn.close()
print('DB OK')
