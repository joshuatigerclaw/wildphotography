/**
 * Derivative Repair Agent - Batch 1
 * 
 * Repairs broken derivative URLs for published photos.
 * ~17,000 small derivatives are 404 - files reorganized in R2 but DB URLs not updated.
 * 
 * Strategy:
 * 1. Find photos with original_r2_key that have derivative URLs with known-bad patterns
 * 2. Download original from R2
 * 3. Regenerate all 4 derivatives (thumb, small, medium, large) as WEBP
 * 4. Upload to R2 at current canonical path
 * 5. Update DB URLs
 */

import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { neon } from '@neondatabase/serverless';
import https from 'https';
import http from 'http';

const NEON_CONNECTION = 'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// R2 config
const R2_CONFIG = {
  endpoint: 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
  region: 'auto',
  bucket: 'wildphoto-storage',
  accessKeyId: 'b821d56d29d9a2c716f783fc481e2f75',
  secretAccessKey: '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f',
  publicUrl: 'https://images.wildphotography.com',
};

// Derivative sizes
const DERIVATIVES = {
  thumb: { width: 400, suffix: 'thumbs', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 90 },
  large: { width: 2400, suffix: 'large', quality: 92 },
};

// Known bad URL patterns (from derivative-integrity-report)
const BAD_PATTERNS = [
  '/wildphoto-storage/',
  '/web_smalls/',
  '/web_small/',
  '/smalls/',
  '/photos/',
  '/photos/derivatives/',
  '/derivatives/photos/',
  '/derivatives/web_smalls/',
  '/derivatives/photos/',
];

function isLikelyBrokenUrl(url) {
  if (!url) return false;
  for (const pattern of BAD_PATTERNS) {
    if (url.includes(pattern)) return true;
  }
  return false;
}

function buildCanonicalKey(photoId, size, format = 'webp') {
  return `derivatives/${DERIVATIVES[size].suffix}/${photoId}.${format}`;
}

function buildCanonicalUrl(photoId, size) {
  return `${R2_CONFIG.publicUrl}/derivatives/${DERIVATIVES[size].suffix}/${photoId}.webp`;
}

async function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve({ status: 0, exists: false });
      return;
    }
    try {
      const parsed = new URL(url);
      const protocol = parsed.protocol === 'https:' ? https : http;
      const req = protocol.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve({ status: res.statusCode, exists: res.statusCode === 200 });
      });
      req.on('error', () => resolve({ status: 0, exists: false }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, exists: false }); });
      req.end();
    } catch {
      resolve({ status: 0, exists: false });
    }
  });
}

// S3 client for R2
const s3Client = new S3Client({
  endpoint: R2_CONFIG.endpoint,
  region: R2_CONFIG.region,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

async function downloadFromR2(key) {
  try {
    const command = new GetObjectCommand({ Bucket: R2_CONFIG.bucket, Key: key });
    const response = await s3Client.send(command);
    const chunks = [];
    const stream = response.Body;
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`[R2] Failed to download ${key}:`, error.message);
    return null;
  }
}

async function uploadToR2(buffer, key, contentType = 'image/webp') {
  try {
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error(`[R2] Failed to upload ${key}:`, error.message);
    return false;
  }
}

async function generateDerivative(buffer, sizeName) {
  const config = DERIVATIVES[sizeName];
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 1;
  const originalHeight = metadata.height || 1;
  const aspectRatio = originalHeight / originalWidth;
  
  let targetWidth = config.width;
  let targetHeight = Math.round(targetWidth * aspectRatio);
  
  if (originalWidth < targetWidth) {
    targetWidth = originalWidth;
    targetHeight = originalHeight;
  }
  
  return sharp(buffer)
    .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: config.quality })
    .toBuffer();
}

async function updatePhotoInDB(photoId, urls) {
  const sql = neon(NEON_CONNECTION);
  try {
    await sql`
      UPDATE photos SET
        thumb_url = ${urls.thumb_url},
        small_url = ${urls.small_url},
        medium_url = ${urls.medium_url},
        large_url = ${urls.large_url},
        derivatives_complete = true,
        ready_for_public_render = true
      WHERE id = ${photoId}
    `;
    return true;
  } catch (error) {
    console.error(`[DB] Failed to update photo ${photoId}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('=== Derivative Repair Agent - Batch 1 ===');
  console.log('Started:', new Date().toISOString());
  
  const results = {
    batch: 1,
    startedAt: new Date().toISOString(),
    photosAttempted: 0,
    photosRepaired: 0,
    photosFailed: 0,
    cannotRepair: 0,
    r2UploadFailed: 0,
    skipped: 0,
    repairs: [],
    failures: [],
  };
  
  const sql = neon(NEON_CONNECTION);
  
  // Find photos with originals that have likely-broken derivative URLs
  // We'll use a two-stage approach:
  // 1. First get photos with original_r2_key where at least one derivative looks broken
  // 2. Check which derivatives actually return 404
  
  console.log('\n[1] Querying photos with original_r2_key...');
  
  // Get photos that have original_r2_key and are published/ready
  // AND have derivative URLs that match broken patterns
  const photos = await sql`
    SELECT 
      p.id,
      p.slug,
      p.original_r2_key,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.r2_thumb_key,
      p.r2_web_small_key,
      p.r2_web_large_key,
      p.r2_print_key
    FROM photos p
    WHERE p.is_active = true
      AND p.ready_for_public_render = true
      AND p.original_r2_key IS NOT NULL
      AND p.original_r2_key != ''
      AND (
        (p.small_url IS NOT NULL AND p.small_url LIKE '%/smalls/%')
        OR (p.small_url IS NOT NULL AND p.small_url LIKE '%/web_smalls/%')
        OR (p.small_url IS NOT NULL AND p.small_url LIKE '%/photos/%')
        OR (p.small_url IS NOT NULL AND p.small_url LIKE '%/wildphoto-storage/%')
        OR (p.medium_url IS NOT NULL AND p.medium_url LIKE '%/photos/%')
        OR (p.large_url IS NOT NULL AND p.large_url LIKE '%/photos/%')
      )
    LIMIT 50
  `;
  
  console.log(`Found ${photos.length} candidate photos with legacy broken patterns`);
  
  results.photosAttempted = photos.length;
  
  for (const photo of photos) {
    const repair = {
      photoId: photo.id,
      slug: photo.slug,
      originalKey: photo.original_r2_key,
      repaired: false,
      error: null,
      derivatives: {},
    };
    
    try {
      // Check if original exists in R2
      if (!photo.original_r2_key) {
        repair.error = 'no_original_r2_key';
        results.cannotRepair++;
        results.failures.push(repair);
        continue;
      }
      
      // Try to download original from R2
      const originalBuffer = await downloadFromR2(photo.original_r2_key);
      if (!originalBuffer) {
        // Try alternative path patterns
        const altKeys = [
          photo.original_r2_key.replace('/originals/', '/originals/'),
          `originals/${photo.id}.jpg`,
          `originals/${photo.slug}.jpg`,
        ];
        let downloaded = false;
        for (const altKey of altKeys) {
          const buf = await downloadFromR2(altKey);
          if (buf) {
            repair.originalKey = altKey;
            downloaded = true;
            break;
          }
        }
        if (!downloaded) {
          repair.error = 'original_not_found_in_r2';
          results.cannotRepair++;
          results.failures.push(repair);
          continue;
        }
      }
      
      // Re-download with correct buffer
      const buf = await downloadFromR2(repair.originalKey || photo.original_r2_key);
      if (!buf) {
        repair.error = 'original_not_found_in_r2';
        results.cannotRepair++;
        results.failures.push(repair);
        continue;
      }
      
      const newUrls = {};
      
      // Generate each derivative
      for (const [size, config] of Object.entries(DERIVATIVES)) {
        try {
          const derivBuffer = await generateDerivative(buf, size);
          const key = buildCanonicalKey(String(photo.id), size, 'webp');
          const uploaded = await uploadToR2(derivBuffer, key);
          
          if (uploaded) {
            newUrls[`${size}_url`] = buildCanonicalUrl(String(photo.id), size);
            repair.derivatives[size] = { key, url: newUrls[`${size}_url`], size: derivBuffer.length };
          } else {
            repair.error = `r2_upload_failed_${size}`;
            results.r2UploadFailed++;
            break;
          }
        } catch (e) {
          repair.error = `derivative_generation_failed_${size}`;
          results.r2UploadFailed++;
          break;
        }
      }
      
      if (repair.error) {
        results.failures.push(repair);
        results.photosFailed++;
        continue;
      }
      
      // Update DB
      const updated = await updatePhotoInDB(photo.id, {
        thumb_url: newUrls.thumb_url,
        small_url: newUrls.small_url,
        medium_url: newUrls.medium_url,
        large_url: newUrls.large_url,
      });
      
      if (updated) {
        repair.repaired = true;
        results.repairs.push(repair);
        results.photosRepaired++;
      } else {
        repair.error = 'db_update_failed';
        results.failures.push(repair);
        results.photosFailed++;
      }
    } catch (e) {
      repair.error = e.message;
      results.failures.push(repair);
      results.photosFailed++;
    }
    
    // Progress logging
    process.stdout.write(`.`);
  }
  
  console.log('\n');
  
  // Health check - sample 20 repaired photos
  console.log('\n[2] Running health check on 20 sample repaired photos...');
  const sampleRepairs = results.repairs.slice(0, Math.min(20, results.repairs.length));
  let healthCheckPassed = 0;
  
  for (const repair of sampleRepairs) {
    const checks = [];
    for (const [size, data] of Object.entries(repair.derivatives)) {
      const result = await checkUrl(data.url);
      checks.push({ size, url: data.url, status: result.status, exists: result.exists });
    }
    const allPass = checks.every(c => c.exists);
    if (allPass) healthCheckPassed++;
    else {
      console.log(`  FAIL: photo ${repair.photoId} - ${checks.filter(c => !c.exists).map(c => c.size).join(', ')}`);
    }
  }
  
  results.healthCheck = {
    sampled: sampleRepairs.length,
    passed: healthCheckPassed,
    failed: sampleRepairs.length - healthCheckPassed,
  };
  
  // Summary
  results.completedAt = new Date().toISOString();
  
  const repairRate = results.photosAttempted > 0 
    ? ((results.photosRepaired / results.photosAttempted) * 100).toFixed(1) 
    : 0;
  
  console.log('\n=== Batch 1 Summary ===');
  console.log(`Photos attempted: ${results.photosAttempted}`);
  console.log(`Photos repaired: ${results.photosRepaired}`);
  console.log(`Photos failed: ${results.photosFailed}`);
  console.log(`Cannot repair (missing original): ${results.cannotRepair}`);
  console.log(`R2 upload failed: ${results.r2UploadFailed}`);
  console.log(`Repair rate: ${repairRate}%`);
  console.log(`Health check: ${healthCheckPassed}/${sampleRepairs.length} passed`);
  
  if (repairRate < 80) {
    console.log('\n⚠️  WARNING: Repair rate below 80% - investigate approach!');
    results.alert = 'repair_rate_below_threshold';
  }
  
  // Save report
  const reportPath = `${process.env.HOME}/wildphotography_cloudflare_src/logs/derivative-repair-batch-1.json`;
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport saved: ${reportPath}`);
  
  console.log('\nDone.');
}

main().catch(console.error);