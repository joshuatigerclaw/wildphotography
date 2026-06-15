/**
 * Derivative Repair Agent - Batch Script
 * Repairs broken derivative URLs for published photos.
 */

import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { neon } from '@neondatabase/serverless';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || '/Users/joshuatenbrink';
const LOG_DIR = path.join(HOME, 'wildphotography_cloudflare_src', 'logs');
const NEON_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2 = {
  endpoint: 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
  bucket: 'wildphoto-storage',
  accessKeyId: 'b821d56d29d9a2c716f783fc481e2f75',
  secretAccessKey: '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f',
  publicUrl: 'https://images.wildphotography.com',
};

const DERIV = {
  thumb: { width: 400, suffix: 'thumbs', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 90 },
  large: { width: 2400, suffix: 'large', quality: 92 },
};

const s3 = new S3Client({
  endpoint: R2.endpoint, region: 'auto',
  credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
});

// Check HTTP URL
async function checkUrl(url) {
  return new Promise(resolve => {
    if (!url?.startsWith('http')) { resolve({ status: 0 }); return; }
    const req = (url.startsWith('https') ? https : http).request(url, { method: 'HEAD', timeout: 5000 }, res => {
      resolve({ status: res.statusCode });
    });
    req.on('error', () => resolve({ status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0 }); });
    req.end();
  });
}

async function r2Get(key) {
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: R2.bucket, Key: key }));
    const chunks = [];
    for await (const c of Body) chunks.push(c);
    return Buffer.concat(chunks);
  } catch (e) { return null; }
}

async function r2Put(key, buf, type = 'image/webp') {
  try {
    await s3.send(new PutObjectCommand({ Bucket: R2.bucket, Key: key, Body: buf, ContentType: type }));
    return true;
  } catch (e) { return false; }
}

async function genDeriv(buf, size) {
  const cfg = DERIV[size];
  const meta = await sharp(buf).metadata();
  const ar = (meta.height || 1) / (meta.width || 1);
  let w = cfg.width, h = Math.round(w * ar);
  if ((meta.width || 1) < w) { w = meta.width || 1; h = meta.height || 1; }
  return sharp(buf).resize(w, h, { fit: 'inside', withoutEnlargement: true }).webp({ quality: cfg.quality }).toBuffer();
}

async function main() {
  const BATCH = parseInt(process.argv[2] || '1');
  const BATCH_SIZE = 50;
  const offset = (BATCH - 1) * BATCH_SIZE;
  
  const results = {
    batch: BATCH, startedAt: new Date().toISOString(),
    attempted: 0, repaired: 0, failed: 0, cannotRepair: 0,
    repairs: [], failures: [],
  };

  const sql = neon(NEON_CONNECTION);
  
  // Query photos with legacy broken patterns
  const photos = await sql`
    SELECT id, slug, original_r2_key, thumb_url, small_url, medium_url, large_url
    FROM photos
    WHERE is_active = true
      AND ready_for_public_render = true
      AND original_r2_key IS NOT NULL
      AND (
        small_url LIKE '%/smalls/%' OR small_url LIKE '%/web_smalls/%'
        OR small_url LIKE '%/photos/%' OR small_url LIKE '%/wildphoto-storage/%'
        OR (medium_url IS NOT NULL AND medium_url LIKE '%/photos/%')
        OR (large_url IS NOT NULL AND large_url LIKE '%/photos/%')
      )
    LIMIT ${BATCH_SIZE}
    OFFSET ${offset}
  `;
  
  results.attempted = photos.length;
  console.log(`[Batch ${BATCH}] Found ${photos.length} candidates to repair`);
  
  for (const photo of photos) {
    process.stdout.write('.');
    
    const entry = { photoId: photo.id, slug: photo.slug, repaired: false, error: null, derivs: {} };
    
    try {
      // Download original
      const buf = await r2Get(photo.original_r2_key);
      if (!buf) {
        entry.error = 'original_not_found_in_r2';
        results.cannotRepair++;
        results.failures.push(entry);
        continue;
      }
      
      // Generate all 4 derivatives
      const newUrls = {};
      let ok = true;
      
      for (const [size, cfg] of Object.entries(DERIV)) {
        try {
          const dBuf = await genDeriv(buf, size);
          const key = `derivatives/${cfg.suffix}/${photo.id}.webp`;
          const uploaded = await r2Put(key, dBuf);
          
          if (uploaded) {
            newUrls[`${size}_url`] = `${R2.publicUrl}/${key}`;
            entry.derivs[size] = { key, url: newUrls[`${size}_url`], bytes: dBuf.length };
          } else {
            entry.error = `r2_upload_failed_${size}`;
            ok = false;
            break;
          }
        } catch (e) {
          entry.error = `deriv_failed_${size}`;
          ok = false;
          break;
        }
      }
      
      if (!ok) { results.failures.push(entry); results.failed++; continue; }
      
      // Update DB
      try {
        await sql`UPDATE photos SET 
          thumb_url = ${newUrls.thumb_url}, 
          small_url = ${newUrls.small_url}, 
          medium_url = ${newUrls.medium_url}, 
          large_url = ${newUrls.large_url}, 
          derivatives_complete = true, 
          ready_for_public_render = true 
          WHERE id = ${photo.id}`;
      } catch (e) {
        entry.error = 'db_update_failed: ' + e.message;
        results.failures.push(entry);
        results.failed++;
        continue;
      }
      
      entry.repaired = true;
      results.repairs.push(entry);
      results.repaired++;
      
    } catch (e) {
      entry.error = e.message;
      results.failures.push(entry);
      results.failed++;
    }
  }
  
  console.log('\n');
  
  // Health check - test small_url of sample repairs
  console.log('[Health Check] Testing repaired URLs...');
  const sample = results.repairs.slice(0, Math.min(20, results.repairs.length));
  let healthPass = 0;
  
  for (const r of sample) {
    const url = r.derivs.small?.url;
    if (!url) continue;
    const { status } = await checkUrl(url);
    if (status === 200) healthPass++;
    else console.log(`  FAIL photo ${r.photoId}: ${url} returned ${status}`);
  }
  
  results.healthCheck = { sampled: sample.length, passed: healthPass, failed: sample.length - healthPass };
  
  results.completedAt = new Date().toISOString();
  const rate = results.attempted > 0 ? ((results.repaired / results.attempted) * 100).toFixed(1) : 0;
  
  console.log(`\n=== Batch ${BATCH} Summary ===`);
  console.log(`Attempted: ${results.attempted}`);
  console.log(`Repaired: ${results.repaired}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Cannot repair: ${results.cannotRepair}`);
  console.log(`Repair rate: ${rate}%`);
  console.log(`Health check: ${healthPass}/${sample.length} URLs returning HTTP 200`);
  
  if (parseFloat(rate) < 80) {
    console.log('\n⚠️  ALERT: Repair rate below 80%!');
    results.alert = 'repair_rate_below_threshold';
  }
  
  // Save report
  const reportPath = path.join(LOG_DIR, `derivative-repair-BATCH${BATCH}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport: ${reportPath}`);
  
  // Count remaining
  const remaining = await sql`SELECT COUNT(*) as cnt FROM photos WHERE is_active = true AND ready_for_public_render = true AND original_r2_key IS NOT NULL AND (small_url LIKE '%/smalls/%' OR small_url LIKE '%/web_smalls/%' OR small_url LIKE '%/photos/%' OR small_url LIKE '%/wildphoto-storage/%' OR medium_url LIKE '%/photos/%' OR large_url LIKE '%/photos/%')`;
  console.log(`Remaining to repair: ${remaining[0].cnt}`);
}

main().catch(e => { console.error(e); process.exit(1); });