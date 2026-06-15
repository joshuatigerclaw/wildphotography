#!/usr/bin/env node
/**
 * GPS Extraction Batch Script
 * Downloads originals from R2, extracts GPS via exiftool, updates Neon DB
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const R2_BUCKET = 'wildphoto-storage';
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_PROFILE = 'wp_repair';
const DB_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const TEMP_DIR = '/tmp/gps_extract';

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function extractGPS(filePath) {
  try {
    const latOut = execSync(`exiftool -c "%.7f" -GPSLatitude "${filePath}"`, { encoding: 'utf8' }).trim();
    const lonOut = execSync(`exiftool -c "%.7f" -GPSLongitude "${filePath}"`, { encoding: 'utf8' }).trim();
    
    // Format: 'GPS Latitude                    : 9.6143300 N'
    const latMatch = latOut.match(/([-\d.]+)\s*([NSEW])/);
    const lonMatch = lonOut.match(/([-\d.]+)\s*([NSEW])/);
    
    if (!latMatch || !lonMatch) {
      return { lat: null, lon: null };
    }
    
    let lat = parseFloat(latMatch[1]);
    let lon = parseFloat(lonMatch[1]);
    
    if (latMatch[2] === 'S') lat = -lat;
    if (lonMatch[2] === 'W') lon = -lon;
    
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
      return { lat: null, lon: null };
    }
    
    return { lat, lon };
  } catch (e) {
    return { lat: null, lon: null };
  }
}

function downloadFromR2(r2Key, localPath) {
  try {
    // Quote r2Key to handle spaces, parentheses, and special chars in filenames
    const cmd = `aws s3 cp s3://${R2_BUCKET}/'${r2Key}' "${localPath}" --profile ${R2_PROFILE} --endpoint ${R2_ENDPOINT}`;
    execSync(cmd, { stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch (e) {
    // Log the error for debugging
    try {
      const errCmd = `aws s3 cp s3://${R2_BUCKET}/'${r2Key}' "${localPath}" --profile ${R2_PROFILE} --endpoint ${R2_ENDPOINT} 2>&1`;
      const errOut = execSync(errCmd, { encoding: 'utf8', stdio: 'pipe', shell: '/bin/bash' });
      console.error(`Download failed for key ${r2Key}: ${errOut.substring(0, 200)}`);
    } catch (e2) {}
    return false;
  }
}

function updateDB(photoId, lat, lon, hasGps) {
  try {
    if (hasGps) {
      execSync(`PGPASSWORD='npg_BvF2JsQ8drba' psql "${DB_CONNECTION}" -c "UPDATE photos SET latitude = ${lat}, longitude = ${lon}, lat = ${lat}, lon = ${lon}, gps_source = 'exif' WHERE id = ${photoId};"`, { stdio: 'pipe' });
    } else {
      execSync(`PGPASSWORD='npg_BvF2JsQ8drba' psql "${DB_CONNECTION}" -c "UPDATE photos SET gps_source = 'checked' WHERE id = ${photoId};"`, { stdio: 'pipe' });
    }
    return true;
  } catch (e) {
    return false;
  }
}

function getPhotoBatch(limit) {
  try {
    // Use r2_original_key (correct R2 keys) with fallback to original_r2_key (legacy/stale)
    // Also normalize: strip 'wildphoto-storage/' prefix and full URLs from legacy keys
    const result = execSync(`PGPASSWORD='npg_BvF2JsQ8drba' psql "${DB_CONNECTION}" -t -c "SELECT id, COALESCE(NULLIF(r2_original_key, ''), NULLIF(original_r2_key, '')) AS r2_key FROM photos WHERE latitude IS NULL AND COALESCE(NULLIF(r2_original_key, ''), NULLIF(original_r2_key, '')) IS NOT NULL AND COALESCE(NULLIF(r2_original_key, ''), NULLIF(original_r2_key, '')) != '' AND COALESCE(NULLIF(r2_original_key, ''), NULLIF(original_r2_key, '')) != ' ' AND (gps_source IS NULL OR gps_source = '' OR gps_source = 'exif') ORDER BY id LIMIT ${limit};"`, { encoding: 'utf8' });
    return result.trim().split('\n').filter(r => r.trim()).map(row => {
      const [id, r2Key] = row.split('|').map(s => s.trim());
      let key = r2Key || '';
      // Skip full URLs (SmugMug URLs stored as keys) - these can't be downloaded from R2
      if (key.startsWith('http://') || key.startsWith('https://')) {
        // Extract R2 object key from URL like https://pub-xxx.r2.dev/photos/gallery/slug/file.jpg
        // The key is the path after the domain, e.g. photos/gallery/slug/file.jpg
        try {
          const url = new URL(key);
          key = url.pathname.replace(/^\//, ''); // strip leading slash
        } catch (e) {
          return null;
        }
      }
      return { id: parseInt(id), r2Key: key };
    }).filter(r => r && r.r2Key);
  } catch (e) {
    return [];
  }
}

async function processPhoto(photo) {
  const localPath = path.join(TEMP_DIR, `photo_${photo.id}_${path.basename(photo.r2Key)}`);
  if (!downloadFromR2(photo.r2Key, localPath)) {
    // Mark as checked so we don't re-query the same missing files every batch
    updateDB(photo.id, null, null, false);
    return { id: photo.id, status: 'download_failed' };
  }
  const { lat, lon } = extractGPS(localPath);
  try { fs.unlinkSync(localPath); } catch (e) {}
  if (lat === null || lon === null) {
    updateDB(photo.id, null, null, false);
    return { id: photo.id, status: 'no_gps' };
  }
  if (updateDB(photo.id, lat, lon, true)) return { id: photo.id, status: 'success', lat, lon };
  return { id: photo.id, status: 'db_failed' };
}

async function runBatch(batchSize) {
  console.log(`Batch size: ${batchSize}`);
  const photos = getPhotoBatch(batchSize);
  if (photos.length === 0) return { success: 0, noGps: 0, failed: 0 };
  let success = 0, noGps = 0, failed = 0;
  for (const photo of photos) {
    process.stdout.write(`${photo.id}... `);
    const result = await processPhoto(photo);
    if (result.status === 'success') { console.log(`OK (${result.lat.toFixed(4)}, ${result.lon.toFixed(4)})`); success++; }
    else if (result.status === 'no_gps') { console.log('no GPS'); noGps++; }
    else { console.log(result.status); failed++; }
  }
  console.log(`Results: ${success} success, ${noGps} no GPS, ${failed} failed`);
  return { success, noGps, failed };
}

const batchSize = (() => {
  const arg = parseInt(process.argv[2] || '25');
  if (isNaN(arg) || arg < 1) return 25;
  return arg;
})();
runBatch(batchSize).then(r => {
  console.log('DONE');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });