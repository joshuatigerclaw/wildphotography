/**
 * SmugMug Download Pipeline - Using wrangler for R2
 * 
 * Downloads images from SmugMug, uploads to R2 via wrangler
 */

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// Config
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// SmugMug OAuth
const API_KEY = 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const API_SECRET = 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp';
const ACCESS_TOKEN = '2tGrWkWHMWP6S99WXWcd6f7R7hXp2cpC';
const ACCESS_SECRET = 'vmzqFhX7j98NzndRJsMb9QvJX6QVCDW6Zk45Qc7z5hjRqfVdNH6SPJ9Nqct5KF3k';

const R2_TOKEN = 'VcSgOA9VsIcjE85VD1nAKiAMenj-1SB255hsnvE0';

const sql = neon(DATABASE_URL);

// OAuth
const OAuth = require('oauth-1.0a');
const oauth = new OAuth({
  consumer: { key: API_KEY, secret: API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  }
});

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = { method: 'GET', url: url };
    const auth = oauth.toHeader(oauth.authorize(request, { key: ACCESS_TOKEN, secret: ACCESS_SECRET }));
    
    const req = https.get(url, { headers: { ...auth, 'Accept': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
  });
}

function downloadImage(url) {
  return new Promise((resolve) => {
    const request = { method: 'GET', url: url };
    const auth = oauth.toHeader(oauth.authorize(request, { key: ACCESS_TOKEN, secret: ACCESS_SECRET }));
    
    const req = https.get(url, { headers: { ...auth } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
  });
}

function uploadToR2(key, data) {
  return new Promise((resolve) => {
    // Write to temp file
    const tempFile = path.join(os.tmpdir(), key.replace(/\//g, '_'));
    fs.writeFileSync(tempFile, data);
    
    try {
      // Use wrangler r2 object put (remote)
      const cmd = `CLOUDFLARE_API_TOKEN=${R2_TOKEN} npx wrangler r2 object put wildphoto-storage/${key} --file=${tempFile} --remote 2>&1`;
      const result = execSync(cmd, { encoding: 'utf8' });
      console.log('  R2:', result.trim());
      fs.unlinkSync(tempFile);
      resolve(true);
    } catch (error) {
      console.error('  R2 Error:', error.message);
      fs.unlinkSync(tempFile);
      resolve(false);
    }
  });
}

async function getAlbumImages(albumKey) {
  const url = `https://api.smugmug.com/api/v2/album/${albumKey}!images?start=1&limit=100`;
  const data = await fetchJson(url);
  return data.Response?.AlbumImage || [];
}

async function processPhoto(photo) {
  const imageKey = photo.ImageKey;
  const filename = photo.FileName || `image-${imageKey}.jpg`;
  const slug = filename.toLowerCase().replace(/\s+/g, '-').replace('.jpg', '');
  
  console.log(`\n[${imageKey}] ${filename}`);
  
  // Get thumbnail URL (public)
  const thumbnailUrl = photo.ThumbnailUrl;
  if (!thumbnailUrl) {
    console.log('  No thumbnail');
    return false;
  }
  
  // Download
  console.log('  Downloading...');
  const imageData = await downloadImage(thumbnailUrl);
  if (!imageData) {
    console.log('  Download failed');
    return false;
  }
  
  console.log(`  ${imageData.length} bytes`);
  
  // Upload to R2
  const r2Key = `originals/${slug}.jpg`;
  console.log(`  Uploading: ${r2Key}`);
  
  const uploaded = await uploadToR2(r2Key, imageData);
  if (!uploaded) {
    console.log('  Upload failed');
    return false;
  }
  
  console.log('  ✓ Uploaded');
  
  // Update DB
  const mediaBase = 'https://wildphotography-media.josh-ec6.workers.dev';
  await sql(`
    UPDATE photos SET
      original_r2_key = $1,
      thumb_url = $2,
      small_url = $3,
      medium_url = $4,
      large_url = $5,
      date_modified = NOW()
    WHERE smugmug_key = $6
  `, [
    r2Key,
    `${mediaBase}/derivatives/thumbs/${slug}-thumb.jpg`,
    `${mediaBase}/derivatives/small/${slug}-small.jpg`,
    `${mediaBase}/derivatives/medium/${slug}-medium.jpg`,
    `${mediaBase}/derivatives/large/${slug}-large.jpg`,
    imageKey
  ]);
  
  console.log('  ✓ DB updated');
  
  return true;
}

async function main() {
  const albumKey = process.argv[2] || 'ZXn2L5';
  
  console.log(`=== SmugMug Download Pipeline ===`);
  console.log(`Album: ${albumKey}\n`);
  
  // Get images
  console.log('Fetching images...');
  const photos = await getAlbumImages(albumKey);
  console.log(`Found ${photos.length} images\n`);
  
  var processed = 0;
  var failed = 0;
  
  for (var i = 0; i < photos.length; i++) {
    var photo = photos[i];
    
    try {
      var success = await processPhoto(photo);
      if (success) processed++;
      else failed++;
    } catch (error) {
      console.error('Error:', error);
      failed++;
    }
  }
  
  console.log(`\n=== Complete (first 5) ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
