/**
 * Wildphotography Derivative Restoration Script
 * 
 * STORAGE-ONLY: Does NOT update database
 * 
 * Generates and uploads derivatives to R2 with correct ID-based naming:
 * - derivatives/thumbs/{id}-thumb.jpg
 * - derivatives/smalls/{id}-small.jpg
 * - derivatives/mediums/{id}-medium.jpg
 * - derivatives/larges/{id}-large.jpg
 * - derivatives/previews/{id}-preview.jpg
 * 
 * Usage:
 *   R2_SECRET_KEY=xxx node scripts/restore-derivatives.js [--dry-run] [--limit N] [--offset N]
 * 
 * Environment:
 *   R2_SECRET_KEY - R2 secret access key (required)
 *   DATABASE_URL - Neon connection string (optional, has default)
 * 
 * Output:
 *   Prints R2 keys that were uploaded (for later DB update)
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { neon } = require('@neondatabase/serverless');
const got = require('got').default;
const sharp = require('sharp');

// ============================================================
// CONFIGURATION
// ============================================================

const R2_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_BUCKET = 'wildphoto-storage';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// R2 Credentials (Object Read/Write)
const R2_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75';
const R2_ACCESS_SECRET = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f';

const SMUGMUG_API_KEY = '6hJGBgm49JsxZhWnBm3vMFcKnH5tbSd9';
const SMUGMUG_API_SECRET = 'MMD4PRS7x52DSW44jjQHNv9FfqN22RwJf8p8XHWFnjcSkkMwGxHGmcw4DwTcHChs';
const SMUGMUG_ACCESS_TOKEN = '244ntqLqM8gZ38MKrbM67QPdgsws2T7x';
const SMUGMUG_ACCESS_SECRET = '3BdZpBsttNX5rsw94H6Q38CxB4t4NS9pfJDdzJ5GXXxp5F6MN4bcBdjHcfrB67rZ';

const NEON_DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// Derivative sizes - EXACT production format
const SIZES = {
  thumb:   { width: 400,  folder: 'thumbs',   suffix: 'thumb',   quality: 80 },
  small:   { width: 900,  folder: 'smalls',   suffix: 'small',   quality: 85 },
  medium:  { width: 1600, folder: 'mediums',  suffix: 'medium',  quality: 85 },
  large:  { width: 2400, folder: 'larges',    suffix: 'large',   quality: 90 },
  preview: { width: 2800, folder: 'previews',  suffix: 'preview', quality: 92 },
};

// ============================================================
// INITIALIZATION
// ============================================================

const R2_SECRET_KEY = process.env.R2_SECRET_KEY || R2_ACCESS_SECRET;

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

const sql = neon(NEON_DB);

// ============================================================
// UTILITIES
// ============================================================

function generateOauthSignature(url, method, secret, tokenSecret) {
  const crypto = require('crypto');
  const oauthParams = {
    oauth_consumer_key: SMUGMUG_API_KEY,
    oauth_token: SMUGMUG_ACCESS_TOKEN,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex').slice(0, 16),
    oauth_version: '1.0',
  };
  
  const baseString = [
    method.toUpperCase(),
    url,
    Object.entries(oauthParams).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('&')
  ].join('&');
  
  const signingKey = `${SMUGMUG_API_SECRET}&${tokenSecret}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  
  return { ...oauthParams, oauth_signature: signature };
}

async function downloadFromSmugMug(imageKey) {
  const url = `https://api.smugmug.com/api/v2/image/${imageKey}`;
  const oauth = generateOauthSignature(url, 'GET', SMUGMUG_API_SECRET, SMUGMUG_ACCESS_SECRET);
  const authHeader = 'OAuth ' + Object.entries(oauth)
    .filter(([k]) => k.startsWith('oauth_'))
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ');
  
  try {
    const response = await got(url, {
      headers: { Authorization: authHeader },
      responseType: 'json',
    });
    
    if (response.body?.Response?.Image) {
      const imageData = response.body.Response.Image;
      const downloadUrl = imageData.Uri || imageData.URL || imageData.ImageURL;
      
      if (downloadUrl) {
        const imageBuffer = await got.buffer(downloadUrl);
        return imageBuffer;
      }
    }
    throw new Error('No download URL in response');
  } catch (error) {
    console.error(`    SmugMug error: ${error.message}`);
    return null;
  }
}

async function downloadFromR2(key) {
  try {
    const response = await r2.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }));
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

async function uploadToR2(key, buffer, contentType = 'image/jpeg') {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

async function checkExistsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

async function generateDerivative(buffer, size) {
  const config = SIZES[size];
  return sharp(buffer)
    .resize(config.width, null, { withoutEnlargement: true })
    .jpeg({ quality: config.quality })
    .toBuffer();
}

/**
 * Build exact R2 key for derivative
 * Format: derivatives/{folder}/{id}-{suffix}.jpg
 * Example: derivatives/thumbs/795-thumb.jpg
 */
function buildR2Key(id, size) {
  const config = SIZES[size];
  return `derivatives/${config.folder}/${id}-${config.suffix}.jpg`;
}

// ============================================================
// MAIN RESTORATION LOGIC
// ============================================================

async function restoreDerivatives(options = {}) {
  const { dryRun = false, limit = null, offset = 0, skipExisting = true } = options;
  
  console.log('================================================================');
  console.log('Wildphotography Derivative Restoration (STORAGE-ONLY)');
  console.log('================================================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Bucket: ${R2_BUCKET}`);
  console.log('');
  
  // Fetch photos that have source (smugmug_key OR original_r2_key)
  let photos;
  if (limit) {
    photos = await sql`
      SELECT id, slug, smugmug_key, original_r2_key
      FROM photos 
      WHERE is_active = true
        AND (smugmug_key IS NOT NULL OR original_r2_key IS NOT NULL)
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else {
    photos = await sql`
      SELECT id, slug, smugmug_key, original_r2_key
      FROM photos 
      WHERE is_active = true
        AND (smugmug_key IS NOT NULL OR original_r2_key IS NOT NULL)
    `;
  }
  
  console.log(`Photos to process: ${photos.length}`);
  console.log('');
  
  // Track results for output
  const results = [];
  
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let uploaded = 0;
  
  for (const photo of photos) {
    processed++;
    console.log(`[${photo.id}/${processed}] ${photo.slug}:`);
    
    try {
      // Try to get original image
      let originalBuffer = null;
      
      // 1. Try R2 originals first
      if (photo.original_r2_key) {
        console.log(`    Source: R2 ${photo.original_r2_key}`);
        originalBuffer = await downloadFromR2(photo.original_r2_key);
        if (originalBuffer) {
          console.log(`    ✓ Got from R2 (${(originalBuffer.length / 1024).toFixed(1)}KB)`);
        }
      }
      
      // 2. Try SmugMug if R2 failed
      if (!originalBuffer && photo.smugmug_key) {
        console.log(`    Source: SmugMug ${photo.smugmug_key}`);
        originalBuffer = await downloadFromSmugMug(photo.smugmug_key);
        if (originalBuffer) {
          console.log(`    ✓ Got from SmugMug (${(originalBuffer.length / 1024).toFixed(1)}KB)`);
        }
      }
      
      if (!originalBuffer) {
        console.log(`    ✗ No source available`);
        failed++;
        continue;
      }
      
      // Generate and upload derivatives
      const photoResult = {
        id: photo.id,
        slug: photo.slug,
        derivatives: {},
      };
      
      for (const [size, config] of Object.entries(SIZES)) {
        const r2Key = buildR2Key(photo.id, size);
        
        // Check if already exists
        if (skipExisting) {
          const exists = await checkExistsInR2(r2Key);
          if (exists) {
            console.log(`    ✓ ${size} exists: ${r2Key}`);
            photoResult.derivatives[size] = { key: r2Key, status: 'exists' };
            continue;
          }
        }
        
        if (dryRun) {
          console.log(`    [DRY] ${size}: ${r2Key}`);
          photoResult.derivatives[size] = { key: r2Key, status: 'would_upload' };
        } else {
          // Generate derivative
          const derivativeBuffer = await generateDerivative(originalBuffer, size);
          
          // Upload to R2
          await uploadToR2(r2Key, derivativeBuffer);
          
          console.log(`    ✓ ${size}: ${r2Key} (${(derivativeBuffer.length / 1024).toFixed(1)}KB)`);
          photoResult.derivatives[size] = { key: r2Key, status: 'uploaded' };
        }
      }
      
      results.push(photoResult);
      uploaded++;
      
    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);
      failed++;
    }
    
    console.log('');
  }
  
  console.log('================================================================');
  console.log('SUMMARY');
  console.log('================================================================');
  console.log(`Total processed: ${processed}`);
  console.log(`Photos with uploads: ${uploaded}`);
  console.log(`Failed: ${failed}`);
  console.log('');
  
  // Output CSV of uploaded keys (for DB update later)
  if (results.length > 0) {
    console.log('=== KEYS FOR DATABASE UPDATE ===');
    console.log('id,slug,thumb_key,small_key,medium_key,large_key,preview_key');
    
    for (const r of results) {
      const thumb = r.derivatives.thumb?.key || '';
      const small = r.derivatives.small?.key || '';
      const medium = r.derivatives.medium?.key || '';
      const large = r.derivatives.large?.key || '';
      const preview = r.derivatives.preview?.key || '';
      console.log(`${r.id},${r.slug},${thumb},${small},${medium},${large},${preview}`);
    }
    console.log('');
  }
  
  if (dryRun) {
    console.log('>>> DRY RUN COMPLETE - No changes made <<<');
  } else {
    console.log('>>> Upload complete - Run hostname SQL to update DB <<<');
  }
  
  return { processed, uploaded, failed, results };
}

// ============================================================
// CLI
// ============================================================

const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  limit: null,
  offset: 0,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  }
  if (args[i] === '--offset' && args[i + 1]) {
    options.offset = parseInt(args[i + 1], 10);
    i++;
  }
}

restoreDerivatives(options)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
