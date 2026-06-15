#!/usr/bin/env node
/**
 * WildPhotography Derivative Regeneration Batch
 * 
 * Regenerates missing derivatives for photos in the derivative_rebuild_queue.
 * Photos must have a valid source_path pointing to a local file.
 * 
 * Run: node scripts/regenerate_derivatives_batch.js [--batch-size=N] [--dry-run]
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
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: data, ContentType: contentType }));
    return R2_PUBLIC + '/' + key;
  } catch (e) {
    console.log('    [upload fail] ' + key + ': ' + e.message);
    return null;
  }
}

async function generateDerivatives(filePath) {
  const sharp = require('sharp');
  const results = {};
  
  for (const [sizeName, config] of Object.entries(SIZES)) {
    try {
      const buf = await sharp(filePath)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      results[sizeName] = buf;
    } catch (e) {
      console.log('    [deriv fail] ' + sizeName + ': ' + e.message);
      results[sizeName] = null;
    }
  }
  
  return results;
}

async function processPhoto(p) {
  const { id, slug, source_path, original_r2_key } = p;
  
  console.log('\n--- Photo ' + id + ': ' + slug + ' ---');
  
  if (!source_path) {
    console.log('  SKIP: no source_path');
    return { photo_id: id, status: 'skipped', reason: 'no_source_path' };
  }
  
  if (!fs.existsSync(source_path)) {
    console.log('  SKIP: source_path file not found: ' + source_path);
    return { photo_id: id, status: 'skipped', reason: 'source_not_found' };
  }
  
  // Read file with error handling for network filesystem issues
  let fileBuf;
  try {
    fileBuf = fs.readFileSync(source_path);
  } catch (e) {
    console.log('  SKIP: file read error (' + e.code + '): ' + e.message);
    return { photo_id: id, status: 'skipped', reason: 'file_read_error', error: e.message };
  }
  
  if (!fileBuf || fileBuf.length === 0) {
    console.log('  SKIP: empty file');
    return { photo_id: id, status: 'skipped', reason: 'empty_file' };
  }
  const originalKey = original_r2_key || 'originals/' + path.basename(source_path);
  const originalUrl = await upload(originalKey, fileBuf);
  
  if (!originalUrl) {
    console.log('  FAIL: original upload failed');
    return { photo_id: id, status: 'failed', reason: 'original_upload_failed' };
  }
  console.log('  Original: ' + originalUrl);
  
  // Generate derivatives
  const derivs = await generateDerivatives(source_path);
  
  const uploadResults = {};
  let uploadOk = true;
  
  for (const [sizeName, buf] of Object.entries(derivs)) {
    if (!buf) {
      uploadResults[sizeName] = null;
      uploadOk = false;
      continue;
    }
    const config = SIZES[sizeName];
    const ext = path.extname(source_path);
    const base = path.basename(source_path, ext);
    const derivKey = 'derivatives/' + config.folder + '/' + base + '_' + config.suffix + '.jpg';
    const url = await upload(derivKey, buf);
    uploadResults[sizeName] = url;
    if (!url) uploadOk = false;
  }
  
  console.log('  thumb:   ' + (uploadResults.thumb || 'FAIL'));
  console.log('  small:   ' + (uploadResults.small || 'FAIL'));
  console.log('  medium:  ' + (uploadResults.medium || 'FAIL'));
  console.log('  large:   ' + (uploadResults.large || 'FAIL'));
  console.log('  preview: ' + (uploadResults.preview || 'FAIL'));
  
  // Check critical derivatives (thumb + medium must exist)
  const criticalOk = !!(uploadResults.thumb && uploadResults.medium);
  
  // Compute content hash
  const hash = crypto.createHash('md5').update(fileBuf).digest('hex');
  
  // Update Neon
  await sql`
    UPDATE photos SET
      original_r2_key = ${originalKey},
      thumb_url = ${uploadResults.thumb},
      small_url = ${uploadResults.small},
      medium_url = ${uploadResults.medium},
      large_url = ${uploadResults.large},
      preview_url = ${uploadResults.preview},
      derivatives_complete = ${criticalOk},
      ready_for_public_render = ${criticalOk},
      search_ready = ${criticalOk},
      content_hash = ${hash},
      date_modified = NOW()
    WHERE id = ${id}
  `;
  
  console.log('  DB updated -> derivatives_complete=' + criticalOk);
  return { photo_id: id, status: 'ok', derivs_complete: criticalOk };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSize = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '6');
  
  console.log('=== WildPhotography Derivative Regeneration Batch ===');
  console.log('Dry run: ' + dryRun + ', Batch size: ' + batchSize);
  
  // Load queue
  const queuePath = 'runtime/derivative_rebuild_queue.json';
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  
  // Get pending_rebuild photo_ids
  const pendingIds = queue.filter(e => e.status === 'pending_rebuild').map(e => e.photo_id);
  console.log('Pending rebuild queue size: ' + pendingIds.length);
  
  // Take batch
  const batchIds = pendingIds.slice(0, batchSize);
  console.log('Processing batch of ' + batchIds.length + ' photos\n');
  
  let ok = 0, fail = 0, skip = 0;
  const results = [];
  
  for (const id of batchIds) {
    // Get photo from Neon
    const photos = await sql`SELECT id, slug, source_path, original_r2_key FROM photos WHERE id = ${id}`;
    
    if (photos.length === 0) {
      console.log('Photo ' + id + ': NOT FOUND in DB');
      skip++;
      continue;
    }
    
    const p = photos[0];
    
    if (dryRun) {
      console.log('[DRY RUN] Photo ' + p.id + ': ' + p.slug + ' | source: ' + p.source_path);
      ok++;
      continue;
    }
    
    const result = await processPhoto(p);
    results.push(result);
    
    if (result.status === 'ok') ok++;
    else if (result.status === 'skipped') skip++;
    else fail++;
    
    // Rate limit: wait 500ms between photos
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n=== Batch Results ===');
  console.log('OK: ' + ok + ', Failed: ' + fail + ', Skipped: ' + skip);
  
  // Update queue: remove successfully processed photos
  if (!dryRun) {
    const processedIds = results.filter(r => r.status === 'ok').map(r => r.photo_id);
    const newQueue = queue.filter(e => !processedIds.includes(e.photo_id));
    
    // Add results to log
    const logPath = 'logs/regeneration_batch_' + new Date().toISOString().replace(/:/g,'-') + '.json';
    fs.writeFileSync(logPath, JSON.stringify({ timestamp: new Date().toISOString(), results, ok, fail, skip }, null, 2));
    console.log('Log: ' + logPath);
    
    fs.writeFileSync(queuePath, JSON.stringify(newQueue, null, 2));
    console.log('Queue updated: ' + queue.length + ' -> ' + newQueue.length);
  }
}

main().catch(e => { console.error(e); process.exit(1); });