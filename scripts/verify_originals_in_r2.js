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

const SIZES = {
  thumb:   { width: 400,  folder: 'thumbs',   suffix: 'thumb',   quality: 80 },
  small:   { width: 900,  folder: 'smalls',   suffix: 'small',   quality: 85 },
  medium:  { width: 1600, folder: 'mediums',  suffix: 'medium',  quality: 85 },
  large:   { width: 2400, folder: 'larges',   suffix: 'large',   quality: 90 },
  preview: { width: 2800, folder: 'previews', suffix: 'preview', quality: 92 },
};

async function checkOriginal(key) {
  try {
    await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (e) {
    return false;
  }
}

async function upload(key, data, contentType = 'image/jpeg') {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  try {
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: data, ContentType: contentType }));
    return R2_PUBLIC + '/' + key;
  } catch (e) {
    console.log('    upload fail: ' + e.message);
    return null;
  }
}

async function main() {
  const ids = [41781,41782,41787,42063,42064,42065,42066,42067,42070,42071,42072,42073];

  console.log('=== WildPhotography Derivative Regeneration Batch ===\n');
  console.log('Step 1: Verify original R2 keys exist for 12 pending_rebuild photos\n');

  let ok = 0, fail = 0, skip = 0;

  for (const id of ids) {
    const result = await sql`SELECT id, slug, original_r2_key FROM photos WHERE id = ${id}`;
    if (result.length === 0) { console.log('Photo ' + id + ': NOT FOUND'); skip++; continue; }
    const p = result[0];

    console.log('Photo ' + p.id + ': ' + p.slug);
    console.log('  original_r2_key: ' + p.original_r2_key);

    if (!p.original_r2_key) {
      console.log('  SKIP: no original_r2_key');
      skip++;
      continue;
    }

    const originalExists = await checkOriginal(p.original_r2_key);
    if (!originalExists) {
      console.log('  SKIP: original not in R2');
      fail++;
      continue;
    }

    console.log('  Original OK in R2');
    ok++;
    console.log();
  }

  console.log('\n=== Summary ===');
  console.log('Photos with original in R2 (can regenerate): ' + ok);
  console.log('Photos missing original: ' + fail);
  console.log('Skipped: ' + skip);

  if (ok > 0) {
    console.log('\nCan proceed with regeneration for ' + ok + ' photos.');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });