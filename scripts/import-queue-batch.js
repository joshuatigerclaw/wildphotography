#!/usr/bin/env node
/**
 * WildPhotography Queue-Based Batch Import
 * Processes items from import_batch_active.json
 * Respects EXISTING galleries only — never creates new galleries.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { neon } = require('@neondatabase/serverless');
const sharp = require('sharp');

const R2_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_BUCKET = 'wildphoto-storage';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75';
const R2_ACCESS_SECRET = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const NEON_DB = 'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const QUEUE_PATH = '/Users/joshuatenbrink/wildphotography_cloudflare_src/inventory/import_batch_active.json';
const LOG_DIR = '/Users/joshuatenbrink/.openclaw/workspace';
const BATCH_SIZE = 20; // Process 20 photos per run

const r2 = new S3Client({ endpoint: R2_ENDPOINT, region: 'auto', credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_ACCESS_SECRET } });
const sql = neon(NEON_DB);

const SIZES = {
  thumb:   { width: 400,  folder: 'thumbs',   suffix: 'thumb',   quality: 80 },
  small:   { width: 900,  folder: 'smalls',   suffix: 'small',   quality: 85 },
  medium:  { width: 1600, folder: 'mediums',  suffix: 'medium',  quality: 85 },
  large:   { width: 2400, folder: 'larges',   suffix: 'large',   quality: 90 },
  preview: { width: 2800, folder: 'previews', suffix: 'preview', quality: 92 },
};

async function getExistingSlugs() {
  const rows = await sql`SELECT slug FROM photos WHERE is_active = true`;
  return new Set(rows.map(r => r.slug));
}

async function uploadOriginal(filePath, photoId) {
  const filename = path.basename(filePath);
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `originals/${photoId}/${safeName}`;
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: fs.readFileSync(filePath), ContentType: 'image/jpeg' }));
  return key;
}

async function generateDerivatives(originalBuffer, photoId) {
  const results = {};
  for (const [size, cfg] of Object.entries(SIZES)) {
    const key = `derivatives/${cfg.folder}/${photoId}-${cfg.suffix}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: await sharp(originalBuffer).resize(cfg.width, null, { withoutEnlargement: true }).jpeg({ quality: cfg.quality }).toBuffer(),
      ContentType: 'image/jpeg',
    }));
    results[size] = R2_PUBLIC + '/' + key;
  }
  return results;
}

async function run() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Load queue
  if (!fs.existsSync(QUEUE_PATH)) {
    console.log('Queue empty: import_batch_active.json not found');
    process.exit(0);
  }
  
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const pending = queue.filter(i => i.status === 'pending' && i.approved);
  
  if (pending.length === 0) {
    console.log('Queue empty: no pending approved items');
    process.exit(0);
  }
  
  console.log(`Queue: ${queue.length} total, ${pending.length} pending`);
  
  // Get existing slugs to check for duplicates
  const existingSlugs = await getExistingSlugs();
  console.log(`Existing slugs in DB: ${existingSlugs.size}`);
  
  // Process batch
  const batch = pending.slice(0, BATCH_SIZE);
  let imported = 0, duplicates = 0, failed = 0;
  const errors = [];
  
  for (const item of batch) {
    try {
      // Check if already imported by content hash
      const slugBase = path.basename(item.filename, path.extname(item.filename))
        .toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const folderSlug = item.gallery_slug;
      const candidateSlug = `${slugBase}-${folderSlug}`;
      
      if (existingSlugs.has(candidateSlug)) {
        console.log(`  DUPE: ${item.filename} -> ${candidateSlug}`);
        item.status = 'duplicate';
        duplicates++;
        continue;
      }
      
      // Verify source file exists
      if (!fs.existsSync(item.source_path)) {
        console.log(`  MISSING: ${item.source_path}`);
        item.status = 'file_missing';
        item.errors = item.errors || [];
        item.errors.push('source file not found');
        failed++;
        continue;
      }
      
      console.log(`  IMPORT: ${item.filename} -> gallery=${item.gallery_slug} (${item.gallery_id})`);
      
      // Get image metadata
      const meta = await sharp(item.source_path).metadata().catch(() => ({}));
      const title = path.basename(item.filename, path.extname(item.filename)).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Insert photo record
      const result = await sql`
        INSERT INTO photos (
          title, slug, original_r2_key, thumb_url, small_url, medium_url,
          large_url, preview_url, search_ready, ready_for_public_render,
          is_active, gallery_id, date_uploaded, uploaded_at, width, height
        ) VALUES (
          ${title}, ${candidateSlug}, '', '', '', '', '', '',
          true, true, true, ${item.gallery_id}, NOW(), NOW(),
          ${meta.width || 0}, ${meta.height || 0}
        )
        RETURNING id
      `;
      const photoId = result[0].id;
      
      // Upload original
      const origKey = await uploadOriginal(item.source_path, photoId);
      
      // Generate derivatives
      const derivs = await generateDerivatives(fs.readFileSync(item.source_path), photoId);
      
      // Update record with R2 keys and URLs
      await sql`
        UPDATE photos SET
          original_r2_key = ${origKey},
          r2_original_key = ${origKey},
          thumb_url = ${derivs.thumb},
          small_url = ${derivs.small},
          medium_url = ${derivs.medium},
          large_url = ${derivs.large},
          preview_url = ${derivs.preview},
          r2_thumb_key = ${'derivatives/thumbs/' + photoId + '-thumb.jpg'},
          r2_web_small_key = ${'derivatives/smalls/' + photoId + '-small.jpg'},
          r2_web_large_key = ${'derivatives/larges/' + photoId + '-large.jpg'},
          r2_print_key = ${'derivatives/previews/' + photoId + '-preview.jpg'},
          date_modified = NOW()
        WHERE id = ${photoId}
      `;
      
      existingSlugs.add(candidateSlug);
      item.status = 'imported';
      item.photo_id = photoId;
      imported++;
      console.log(`    -> photo_id=${photoId}, slug=${candidateSlug}`);
      
    } catch (e) {
      console.error(`  ERROR ${item.filename}: ${e.message}`);
      item.status = 'error';
      item.errors = item.errors || [];
      item.errors.push(e.message);
      errors.push({ item: item.filename, error: e.message });
      failed++;
    }
  }
  
  // Save updated queue
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
  
  // Log report
  const reportPath = path.join(LOG_DIR, `wild_import_batch_may24_462pm_${timestamp}.json`);
  const report = {
    timestamp,
    total_queue: queue.length,
    processed: batch.length,
    imported,
    duplicates,
    failed,
    errors: errors.slice(0, 10),
    gallery_counts: (() => {
      const m = {};
      for (const i of batch) {
        m[i.gallery_slug] = (m[i.gallery_slug] || 0) + 1;
      }
      return m;
    })()
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n=== BATCH REPORT ===');
  console.log(`Processed: ${batch.length} | Imported: ${imported} | Duplicates: ${duplicates} | Failed: ${failed}`);
  console.log(`Gallery distribution:`, report.gallery_counts);
  console.log(`Report: ${reportPath}`);
  
  // Show sample
  if (imported > 0) {
    const samples = await sql`SELECT id, slug, title, gallery_id FROM photos WHERE is_active = true ORDER BY id DESC LIMIT 3`;
    console.log('\nSample photos:');
    for (const p of samples) console.log(`  ID ${p.id}: ${p.slug} | gallery=${p.gallery_id} | ${p.title}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });