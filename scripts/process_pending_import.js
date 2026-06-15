#!/usr/bin/env node
/**
 * WildPhotography Pending Import Processor
 * Processes photos in 'pending_import' status from local source_path,
 * uploads originals + all 5 derivatives to R2, updates Neon.
 * 
 * Run: node scripts/process_pending_import.js [--limit N]
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { neon } = require('@neondatabase/serverless');

// === CONFIG ===
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75';
const R2_ACCESS_SECRET = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

const NEON_DB = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const SIZES = {
  thumb:   { width: 400,  folder: 'thumbs',   suffix: 'thumb',   quality: 80 },
  small:   { width: 900,  folder: 'smalls',   suffix: 'small',   quality: 85 },
  medium:  { width: 1600, folder: 'mediums',  suffix: 'medium',  quality: 85 },
  large:   { width: 2400, folder: 'larges',   suffix: 'large',   quality: 90 },
  preview: { width: 2800, folder: 'previews', suffix: 'preview', quality: 92 },
};

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_ACCESS_SECRET,
  },
});

const sql = neon(NEON_DB);

async function upload(key, data, contentType = 'image/jpeg') {
  try {
    const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: data, ContentType: contentType });
    await r2.send(cmd);
    return `${R2_PUBLIC}/${key}`;
  } catch (e) {
    console.log(`  [upload fail] ${key}: ${e.message}`);
    return null;
  }
}

async function generateDerivatives(filePath) {
  const sharp = require('sharp');
  const results = {};
  
  for (const [sizeName, config] of Object.entries(SIZES)) {
    const key = `derivatives/${config.folder}/${Date.now()}-${config.suffix}.jpg`;
    try {
      const buf = await sharp(filePath)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      const url = await upload(key, buf);
      results[sizeName] = url ? key : null;
    } catch (e) {
      console.log(`  [deriv fail] ${sizeName}: ${e.message}`);
      results[sizeName] = null;
    }
  }
  
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '15');
  
  console.log(`=== Processing pending_import photos (limit=${limit}) ===`);
  
  // Get pending_import photos with source_path
  const photos = await sql`
    SELECT id, slug, gallery_id, content_hash, source_path
    FROM photos
    WHERE status = 'pending_import'
      AND source_path IS NOT NULL
      AND source_path != ''
    ORDER BY id
    LIMIT ${limit}
  `;
  
  console.log(`Found ${photos.length} pending_import photos\n`);
  
  let ok = 0, fail = 0, skip = 0;
  
  for (const photo of photos) {
    console.log(`\n--- Photo ${photo.id}: ${photo.slug} ---`);
    console.log(`  source: ${photo.source_path}`);
    
    // Check file exists
    if (!fs.existsSync(photo.source_path)) {
      console.log(`  SKIP: file not found`);
      skip++;
      continue;
    }
    
    // Compute hash to verify
    const fileBuf = fs.readFileSync(photo.source_path);
    const hash = crypto.createHash('md5').update(fileBuf).digest('hex');
    
    if (hash !== photo.content_hash) {
      console.log(`  SKIP: content hash mismatch (computed=${hash}, expected=${photo.content_hash})`);
      skip++;
      continue;
    }
    
    // Upload original
    const originalKey = `originals/${path.basename(photo.source_path)}`;
    const originalUrl = await upload(originalKey, fileBuf);
    
    if (!originalUrl) {
      console.log(`  FAIL: original upload failed`);
      fail++;
      continue;
    }
    console.log(`  Original: ${originalUrl}`);
    
    // Generate derivatives
    const derivs = await generateDerivatives(photo.source_path);
    
    const thumbUrl   = derivs.thumb   ? `${R2_PUBLIC}/${derivs.thumb}`   : null;
    const smallUrl   = derivs.small   ? `${R2_PUBLIC}/${derivs.small}`   : null;
    const mediumUrl  = derivs.medium  ? `${R2_PUBLIC}/${derivs.medium}`  : null;
    const largeUrl    = derivs.large   ? `${R2_PUBLIC}/${derivs.large}`   : null;
    const previewUrl = derivs.preview ? `${R2_PUBLIC}/${derivs.preview}` : null;
    
    console.log(`  thumb:   ${thumbUrl || 'FAIL'}`);
    console.log(`  small:   ${smallUrl || 'FAIL'}`);
    console.log(`  medium:  ${mediumUrl || 'FAIL'}`);
    console.log(`  large:   ${largeUrl || 'FAIL'}`);
    console.log(`  preview: ${previewUrl || 'FAIL'}`);
    
    // Check if at least thumb + medium succeeded
    const derivsComplete = !!(thumbUrl && mediumUrl);
    
    // Update DB
    await sql`
      UPDATE photos SET
        original_r2_key = ${originalKey},
        thumb_url = ${thumbUrl},
        small_url = ${smallUrl},
        medium_url = ${mediumUrl},
        large_url = ${largeUrl},
        preview_url = ${previewUrl},
        derivatives_complete = ${derivsComplete},
        ready_for_public_render = ${derivsComplete},
        search_ready = ${derivsComplete},
        status = 'ready',
        date_modified = NOW()
      WHERE id = ${photo.id}
    `;
    
    console.log(`  DB updated → status=ready`);
    ok++;
  }
  
  console.log(`\n=== Done ===`);
  console.log(`OK: ${ok}, Failed: ${fail}, Skipped: ${skip}`);
}

main().catch(e => { console.error(e); process.exit(1); });