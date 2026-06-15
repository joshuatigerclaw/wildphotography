const { neon } = require('@neondatabase/serverless');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const sql = neon('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: '3ec62f93675c404fe4a9a4949e38e5e5',
    secretAccessKey: process.env.R2_SECRET || '',
  },
});

async function verifyPhoto(p) {
  const urls = {
    thumb: p.thumb_url,
    small: p.small_url,
    medium: p.medium_url,
    large: p.large_url,
    preview: p.preview_url,
  };

  let allOk = true;
  for (const [size, url] of Object.entries(urls)) {
    if (!url) {
      console.log('  [' + p.id + '] ' + size + ': MISSING URL');
      allOk = false;
      continue;
    }
    const key = url.replace(R2_PUBLIC + '/', '');
    try {
      await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (e) {
      console.log('  [' + p.id + '] ' + size + ': R2 MISSING - key=' + key);
      allOk = false;
    }
  }
  return allOk;
}

async function main() {
  // Check the 12 pending_rebuild IDs one at a time
  const ids = [41781,41782,41787,42063,42064,42065,42066,42067,42070,42071,42072,42073];

  console.log('Verifying R2 accessibility for 12 pending_rebuild photos:');
  let allPhotosOk = true;

  for (const id of ids) {
    const result = await sql`SELECT id, slug, thumb_url, small_url, medium_url, large_url, preview_url FROM photos WHERE id = ${id}`;
    if (result.length === 0) {
      console.log('  Photo ' + id + ': NOT FOUND');
      continue;
    }
    const p = result[0];
    const ok = await verifyPhoto(p);
    if (!ok) allPhotosOk = false;
  }

  console.log('\nAll R2 derivatives accessible: ' + allPhotosOk);
}

main().catch(e => { console.error(e.message); process.exit(1); });