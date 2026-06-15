import subprocess

conn = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'

r1 = subprocess.run(['psql', conn, '-t', '-c', "SELECT COUNT(*) FROM photos WHERE original_r2_key IS NOT NULL AND original_r2_key != '' AND (thumb_url IS NULL OR thumb_url = '') AND status NOT IN ('archived_unrecoverable', 'archived');"], capture_output=True, text=True)
print('Broken renders:', r1.stdout.strip())

r2 = subprocess.run(['psql', conn, '-t', '-c', "SELECT COUNT(*) FROM photos WHERE status = 'published';"], capture_output=True, text=True)
print('Published:', r2.stdout.strip())

r3 = subprocess.run(['psql', conn, '-t', '-c', "SELECT COUNT(*) FROM pin_queue WHERE status = 'pending_review';"], capture_output=True, text=True)
print('Pinterest pending_review:', r3.stdout.strip())