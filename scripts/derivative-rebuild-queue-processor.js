#!/usr/bin/env node
/**
 * derivative-rebuild-queue-processor.js
 * Processes the derivative_rebuild_queue - regenerates missing derivatives for queued photos
 */

const { Pool } = require('pg');
const sharp = require('sharp');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const NEON_CONFIG = {
  host: 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
  database: 'wildphotography',
  user: 'neondb_owner',
  password: 'npg_8MuC1tvKIOoj',
  ssl: { rejectUnauthorized: false },
  max: 3,
};

const R2_CONFIG = {
  endpoint: 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
  bucket: 'wildphoto-storage',
  accessKey: 'b821d56d29d9a2c716f783fc481e2f75',
  secretKey: '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f',
  publicUrl: 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev',
};

const SIZES = {
  thumb: { width: 400, quality: 80 },
  small: { width: 900, quality: 85 },
  medium: { width: 1600, quality: 85 },
  large: { width: 2400, quality: 90 },
  preview: { width: 1600, quality: 85 },
};

const dbPool = new Pool(NEON_CONFIG);
const s3 = new S3Client({
  endpoint: R2_CONFIG.endpoint,
  region: 'auto',
  credentials: { accessKeyId: R2_CONFIG.accessKey, secretAccessKey: R2_CONFIG.secretKey },
});

async function getObject(key) {
  try {
    const cmd = new GetObjectCommand({ Bucket: R2_CONFIG.bucket, Key: key });
    const resp = await s3.send(cmd);
    if (!resp.Body) return null;
    const chunks = [];
    for await (const chunk of resp.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

async function objectExists(key) {
  try {
    const cmd = new HeadObjectCommand({ Bucket: R2_CONFIG.bucket, Key: key });
    await s3.send(cmd);
    return true;
  } catch {
    return false;
  }
}

async function putObject(key, data, contentType = 'image/jpeg') {
  try {
    const cmd = new PutObjectCommand({ Bucket: R2_CONFIG.bucket, Key: key, Body: data, ContentType: contentType });
    await s3.send(cmd);
    return true;
  } catch (e) {
    console.log(`    putObject error: ${e.message}`);
    return false;
  }
}

async function processPhotoQueueItem(item) {
  const { photo_id, id: queue_id } = item;
  
  // Fetch photo details
  const photoResult = await dbPool.query(
    `SELECT id, slug, original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url,
            r2_thumb_key, r2_web_small_key, r2_web_large_key, r2_print_key
     FROM photos WHERE id = $1`,
    [photo_id]
  );
  
  if (photoResult.rows.length === 0) {
    return { success: false, error: 'photo_not_found', derivativesGenerated: 0 };
  }
  
  const photo = photoResult.rows[0];
  
  if (!photo.original_r2_key) {
    return { success: false, error: 'no_original_r2_key', derivativesGenerated: 0 };
  }
  
  // Get original from R2
  const originalData = await getObject(photo.original_r2_key);
  if (!originalData) {
    return { success: false, error: 'original_not_found_in_r2', derivativesGenerated: 0 };
  }
  
  const derivatives = {};
  let generated = 0;
  let failed = 0;
  
  for (const [sizeName, config] of Object.entries(SIZES)) {
    const slugSlug = photo.slug.replace(/[^a-z0-9-]/gi, '-');
    const r2Key = `derivatives/${sizeName}/${slugSlug}-${sizeName}.jpg`;
    
    // Check if already exists
    const exists = await objectExists(r2Key);
    if (exists) {
      derivatives[sizeName] = { r2_key: r2Key, public_url: `${R2_CONFIG.publicUrl}/${r2Key}` };
      generated++;
      console.log(`    [${sizeName}] Already exists, skipping`);
      continue;
    }
    
    try {
      const derivative = await sharp(originalData)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      
      const ok = await putObject(r2Key, derivative);
      if (ok) {
        derivatives[sizeName] = { r2_key: r2Key, public_url: `${R2_CONFIG.publicUrl}/${r2Key}` };
        generated++;
        console.log(`    [${sizeName}] Generated and uploaded (${derivative.length} bytes)`);
      } else {
        failed++;
        console.log(`    [${sizeName}] FAILED to upload`);
      }
    } catch (e) {
      failed++;
      console.log(`    [${sizeName}] Sharp error: ${e.message}`);
    }
  }
  
  // Update photos table if we generated any derivatives
  if (generated > 0) {
    try {
      await dbPool.query(`
        UPDATE photos SET
          thumb_url = COALESCE($1, thumb_url),
          small_url = COALESCE($2, small_url),
          medium_url = COALESCE($3, medium_url),
          large_url = COALESCE($4, large_url),
          preview_url = COALESCE($5, preview_url),
          r2_thumb_key = COALESCE($6, r2_thumb_key),
          r2_web_small_key = COALESCE($7, r2_web_small_key),
          r2_web_large_key = COALESCE($8, r2_web_large_key),
          derivatives_complete = true,
          ready_for_public_render = true,
          search_ready = true,
          updated_at = NOW()
        WHERE id = $9
      `, [
        derivatives['thumb']?.public_url || null,
        derivatives['small']?.public_url || null,
        derivatives['medium']?.public_url || null,
        derivatives['large']?.public_url || null,
        derivatives['preview']?.public_url || null,
        derivatives['thumb']?.r2_key || null,
        derivatives['small']?.r2_key || null,
        derivatives['large']?.r2_key || null,
        photo_id,
      ]);
    } catch (e) {
      console.log(`    DB update error: ${e.message}`);
    }
  }
  
  // Update queue status
  const newStatus = (generated > 0 && failed === 0) ? 'done' : (generated === 0 && failed > 0) ? 'permanently_failed' : 'partial';
  const qResult = await dbPool.query(
    `UPDATE derivative_rebuild_queue SET 
       status = $1, 
       attempts = attempts + 1, 
       last_error = $2,
       date_modified = NOW()
     WHERE id = $3
     RETURNING id, status`,
    [newStatus, generated === 0 && failed > 0 ? 'all_derivatives_failed' : null, queue_id]
  );
  
  return { success: generated > 0, derivativesGenerated: generated, uploadFailures: failed };
}

async function main() {
  const batchLimit = parseInt(process.argv[2] || '50');
  const startTime = new Date();
  
  console.log(`=== WildPhotography Derivative Rebuild Queue Processor ===`);
  console.log(`Batch limit: ${batchLimit}`);
  console.log(`Started: ${startTime.toISOString()}\n`);
  
  // Get pending queue items
  const queueResult = await dbPool.query(
    `SELECT id, photo_id FROM derivative_rebuild_queue WHERE status IN ('pending', 'processing') ORDER BY date_created ASC LIMIT $1`,
    [batchLimit]
  );
  
  console.log(`Found ${queueResult.rows.length} pending items\n`);
  
  if (queueResult.rows.length === 0) {
    console.log('No pending items to process');
    await dbPool.end();
    return;
  }
  
  let success = 0;
  let failed = 0;
  let partial = 0;
  let totalDerivatives = 0;
  let totalFailures = 0;
  const failureList = [];
  
  for (const item of queueResult.rows) {
    console.log(`Processing queue item ${item.id} (photo ${item.photo_id})...`);
    const result = await processPhotoQueueItem(item);
    
    if (result.success && result.uploadFailures === 0) {
      success++;
      totalDerivatives += result.derivativesGenerated;
      console.log(`  Result: OK (${result.derivativesGenerated} derivs)`);
    } else if (result.success && result.uploadFailures > 0) {
      partial++;
      totalDerivatives += result.derivativesGenerated;
      totalFailures += result.uploadFailures;
      console.log(`  Result: PARTIAL (${result.derivativesGenerated} derivs, ${result.uploadFailures} failures)`);
    } else {
      failed++;
      totalFailures += result.uploadFailures;
      failureList.push({ queue_id: item.id, photo_id: item.photo_id, error: result.error });
      console.log(`  Result: FAILED - ${result.error}`);
    }
  }
  
  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Queue items processed: ${queueResult.rows.length}`);
  console.log(`  - Success: ${success}`);
  console.log(`  - Partial: ${partial}`);
  console.log(`  - Failed: ${failed}`);
  console.log(`Derivatives generated: ${totalDerivatives}`);
  console.log(`Upload failures: ${totalFailures}`);
  
  // Queue status counts
  const statusCounts = await dbPool.query(`SELECT status, COUNT(*) as count FROM derivative_rebuild_queue GROUP BY status`);
  console.log(`\nQueue status counts:`);
  statusCounts.rows.forEach(r => console.log(`  - ${r.status}: ${r.count}`));
  
  if (failureList.length > 0) {
    console.log(`\nFailed items:`);
    failureList.forEach(f => console.log(`  - Queue ${f.queue_id} (photo ${f.photo_id}): ${f.error}`));
  }
  
  console.log(`\nCompleted: ${new Date().toISOString()}`);
  
  await dbPool.end();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});