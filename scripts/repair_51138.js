#!/usr/bin/env node
/**
 * Single photo repair script for photo 51138
 * Downloads original from R2, decodes AppleDouble, generates derivatives, uploads, updates DB
 */
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_PUBLIC = 'https://images.wildphotography.com';
const R2_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75';
const R2_SECRET_KEY = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f';

const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const PHOTO_ID = 51138;
const SLUG = 'beaches--2016-01-13-12-58-06';
const ORIGINAL_KEY = 'originals/18/beaches--2016-01-13-12-58-06-1779344315741.jpg'; // full path

const SIZES = {
  thumb:   { width: 400,  quality: 80 },
  small:   { width: 900,  quality: 85 },
  medium:  { width: 1600, quality: 85 },
  large:   { width: 2400, quality: 90 },
  preview: { width: 1200, quality: 80 },
};

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

function decodeAppleDouble(buf) {
  // AppleDouble magic: 0x00051607
  if (buf.slice(0, 4).toString('hex') !== '00051607') {
    console.log('Not AppleDouble format');
    return null;
  }
  
  const numEntries = buf.readUInt16BE(0x1C);
  console.log('AppleDouble entries:', numEntries);
  
  for (let i = 0; i < numEntries; i++) {
    const off = 0x1E + i * 12;
    const ftype = buf.readUInt32BE(off);
    const offset = buf.readUInt32BE(off + 4);
    const length = buf.readUInt32BE(off + 8);
    
    // DATA fork = 0x00020000
    if (ftype === 0x00020000 && length > 0 && offset + length <= buf.length) {
      const data = buf.slice(offset, offset + length);
      console.log(`Data fork: offset=${offset}, length=${length}, header=${data.slice(0,8).toString('hex')}`);
      return data;
    }
  }
  return null;
}

async function processPhoto() {
  console.log(`=== Repairing photo ${PHOTO_ID}: ${SLUG} ===\n`);
  
  // Step 1: Download original from R2
  console.log('[1] Downloading original from R2...');
  let originalBuf;
  try {
    const resp = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: ORIGINAL_KEY }));
    const chunks = [];
    for await (const chunk of resp.Body) chunks.push(chunk);
    originalBuf = Buffer.concat(chunks);
    console.log(`  Downloaded: ${originalBuf.length} bytes\n`);
  } catch (e) {
    console.log(`  FAILED: ${e.message}`);
    return { success: false, error: 'download_failed' };
  }
  
  // Step 2: Decode AppleDouble
  console.log('[2] Decoding AppleDouble format...');
  const imageBuf = decodeAppleDouble(originalBuf);
  if (!imageBuf) {
    // Try treating as raw JPEG
    console.log('Trying as raw JPEG...');
    imageBuf = originalBuf;
  }
  
  // Verify it's a valid image
  let validImage = false;
  try {
    await sharp(imageBuf).metadata();
    validImage = true;
    console.log('  Image valid (Sharp recognized)\n');
  } catch (e) {
    console.log(`  Not a valid image: ${e.message}`);
    return { success: false, error: 'invalid_image' };
  }
  
  // Step 3: Generate derivatives
  console.log('[3] Generating derivatives...');
  const derivatives = {};
  for (const [size, config] of Object.entries(SIZES)) {
    try {
      const buf = await sharp(imageBuf)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      
      const r2Key = `derivatives/${PHOTO_ID}/${SLUG}_${size}.jpg`;
      
      // Upload to R2
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: buf,
        ContentType: 'image/jpeg',
      }));
      
      derivatives[size] = {
        r2Key,
        url: `${R2_PUBLIC}/derivatives/${PHOTO_ID}/${SLUG}_${size}.jpg`,
        size: buf.length,
      };
      console.log(`  [${size}] ${buf.length} bytes -> ${r2Key}`);
    } catch (e) {
      console.log(`  [${size}] FAILED: ${e.message}`);
    }
  }
  console.log();
  
  // Step 4: Update DB
  if (Object.keys(derivatives).length > 0) {
    console.log('[4] Updating database...');
    const { Pool } = require('pg');
    const pool = new Pool({
      host: 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
      database: 'wildphotography',
      user: 'neondb_owner',
      password: 'npg_BvF2JsQ8drba',
      ssl: { rejectUnauthorized: false },
    });
    
    try {
      await pool.query(`
        UPDATE photos SET
          thumb_url = $1,
          small_url = $2,
          medium_url = $3,
          large_url = $4,
          preview_url = $5,
          derivatives_complete = true,
          ready_for_public_render = true,
          search_ready = true,
          updated_at = NOW()
        WHERE id = $6
      `, [
        derivatives.thumb?.url || '',
        derivatives.small?.url || '',
        derivatives.medium?.url || '',
        derivatives.large?.url || '',
        derivatives.preview?.url || '',
        PHOTO_ID,
      ]);
      console.log('  DB updated successfully\n');
    } catch (e) {
      console.log(`  DB update failed: ${e.message}`);
    }
    await pool.end();
  }
  
  // Step 5: Verify URLs
  console.log('[5] Verifying public URLs...');
  for (const [size, info] of Object.entries(derivatives)) {
    try {
      const resp = await fetch(info.url, { method: 'HEAD' });
      console.log(`  [${size}] ${info.url} -> ${resp.status}`);
    } catch (e) {
      console.log(`  [${size}] ${info.url} -> ERROR: ${e.message}`);
    }
  }
  
  return { success: true, derivatives };
}

processPhoto().then(result => {
  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});