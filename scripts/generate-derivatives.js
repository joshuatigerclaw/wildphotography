/**
 * Derivative Generation Pipeline
 * 
 * Generates derivatives from originals in R2
 * Usage: node scripts/generate-derivatives.js
 */

const { neon } = require('@neondatabase/serverless');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Config
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_TOKEN = 'VcSgOA9VsIcjE85VD1nAKiAMenj-1SB255hsnvE0';

const sql = neon(DATABASE_URL);

// Derivative sizes
const DERIVATIVES = [
  { name: 'thumbs', width: 400 },
  { name: 'small', width: 900 },
  { name: 'medium', width: 1600 },
  { name: 'large', width: 2400 },
];

const MEDIA_BASE = 'https://wildphotography-media.josh-ec6.workers.dev';

function downloadFromR2(key) {
  return new Promise((resolve) => {
    const url = `https://wildphoto-storage.3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com/${key}`;
    
    const req = https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
  });
}

function uploadToR2(key, data) {
  return new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), key.replace(/\//g, '_'));
    fs.writeFileSync(tempFile, data);
    
    try {
      const cmd = `CLOUDFLARE_API_TOKEN=${R2_TOKEN} npx wrangler r2 object put wildphoto-storage/${key} --file=${tempFile} --remote 2>&1`;
      execSync(cmd, { encoding: 'utf8' });
      fs.unlinkSync(tempFile);
      resolve(true);
    } catch (e) {
      console.error('R2 error:', e.message);
      resolve(false);
    }
  });
}

function generateDerivative(inputBuffer, width) {
  const tempIn = path.join(os.tmpdir(), 'input.jpg');
  const tempOut = path.join(os.tmpdir(), 'output.jpg');
  
  fs.writeFileSync(tempIn, inputBuffer);
  
  try {
    execSync(`npx sharp ${tempIn} resize ${width} --output=${tempOut} 2>&1`, { encoding: 'utf8' });
    const output = fs.readFileSync(tempOut);
    fs.unlinkSync(tempIn);
    fs.unlinkSync(tempOut);
    return output;
  } catch (e) {
    console.error('Sharp error:', e.message);
    return inputBuffer;
  }
}

async function processPhoto(photo) {
  const originalKey = photo.original_r2_key;
  if (!originalKey) {
    console.log(`  No original key`);
    return false;
  }
  
  const slug = originalKey.replace('originals/', '').replace('.jpg', '');
  console.log(`\n[${photo.id}] Processing: ${slug}`);
  
  // Download original
  console.log('  Downloading original...');
  const original = await downloadFromR2(originalKey);
  if (!original) {
    console.log('  Download failed');
    return false;
  }
  console.log(`  Got ${original.length} bytes`);
  
  // Generate each derivative
  const urls = {};
  for (const deriv of DERIVATIVES) {
    console.log(`  Generating ${deriv.name}...`);
    const derivative = generateDerivative(original, deriv.width);
    const key = `derivatives/${deriv.name}/${slug}-${deriv.name}.jpg`;
    
    console.log(`  Uploading ${key}...`);
    const uploaded = await uploadToR2(key, derivative);
    if (uploaded) {
      urls[deriv.name] = `${MEDIA_BASE}/${key}`;
      console.log(`  ✓ ${deriv.name}`);
    }
  }
  
  // Update DB with URLs
  if (urls.thumbs) {
    await sql(`
      UPDATE photos SET
        thumb_url = $1,
        small_url = $2,
        medium_url = $3,
        large_url = $4,
        date_modified = NOW()
      WHERE id = $5
    `, [
      urls.thumbs,
      urls.small,
      urls.medium,
      urls.large,
      photo.id
    ]);
    console.log('  ✓ DB updated');
    return true;
  }
  
  return false;
}

async function main() {
  console.log('=== Derivative Generation Pipeline ===\n');
  
  // Get photos with originals
  const photos = await sql(`
    SELECT id, slug, title, original_r2_key
    FROM photos
    WHERE original_r2_key IS NOT NULL
    AND original_r2_key != ''
    LIMIT 10
  `);
  
  console.log(`Found ${photos.length} photos needing derivatives\n`);
  
  let processed = 0;
  for (const photo of photos) {
    const success = await processPhoto(photo);
    if (success) processed++;
  }
  
  console.log(`\n=== Complete ===`);
  console.log(`Processed: ${processed}/${photos.length}`);
}

main().catch(console.error);
