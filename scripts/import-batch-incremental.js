#!/usr/bin/env node
/**
 * WildPhotography Batch 78 - Incremental Import
 * Only processes new files by slug uniqueness check.
 * Uses correct Neon schema (date_uploaded, gallery_id directly on photos table).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { neon } = require('@neondatabase/serverless');
const sharp = require('sharp');

const ROOT = '/Volumes/ADATA SC740/Smugmug Backup/Galleries/Costa-Rica-Gallery';
const R2_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_BUCKET = 'wildphoto-storage';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75';
const R2_ACCESS_SECRET = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const NEON_DB = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const BATCH_SIZE = 100;
const FOLDER_BATCH = 5;

const r2 = new S3Client({ endpoint: R2_ENDPOINT, region: 'auto', credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_ACCESS_SECRET } });
const sql = neon(NEON_DB);

const SIZES = {
  thumb:   { width: 400,  folder: 'thumbs',   suffix: 'thumb',   quality: 80 },
  small:   { width: 900,  folder: 'smalls',   suffix: 'small',   quality: 85 },
  medium:  { width: 1600, folder: 'mediums',  suffix: 'medium',  quality: 85 },
  large:   { width: 2400, folder: 'larges',   suffix: 'large',   quality: 90 },
  preview: { width: 2800, folder: 'previews', suffix: 'preview', quality: 92 },
};

function dirToSlug(d) {
  return d.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function makeSlug(filename, folder) {
  const base = path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const folderSlug = dirToSlug(folder);
  return `${base}-${folderSlug}`;
}

async function getGalleries() {
  const rows = await sql`SELECT slug, id FROM galleries WHERE is_active = true`;
  const m = new Map();
  for (const r of rows) m.set(r.slug, r.id);
  return m;
}

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

async function nextCandidateFolders(galleryMap, n = 5) {
  const dirEntries = fs.readdirSync(ROOT, { withFileTypes: true });
  const folders = dirEntries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
  const candidates = [];
  for (const fname of folders) {
    const slug = dirToSlug(fname);
    if (!galleryMap.has(slug)) continue;
    const fpath = path.join(ROOT, fname);
    const files = fs.readdirSync(fpath).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.tif', '.tiff'].includes(ext) && !f.startsWith('._');
    });
    if (files.length === 0) continue;
    candidates.push({ folder: fname, slug, gallery_id: galleryMap.get(slug), files });
  }
  return candidates.slice(0, n);
}

async function run() {
  const galleryMap = await getGalleries();
  const existingSlugs = await getExistingSlugs();
  console.log(`Galleries: ${galleryMap.size}, Existing slugs: ${existingSlugs.size}`);
  
  const folders = await nextCandidateFolders(galleryMap, FOLDER_BATCH);
  if (folders.length === 0) {
    console.log('No new folders with unmapped galleries found. Library fully imported.');
    process.exit(0);
  }
  
  let totalImported = 0, totalDupes = 0, totalFailed = 0;
  const folderReports = [];
  
  for (const { folder, slug, gallery_id } of folders) {
    const folderPath = path.join(ROOT, folder);
    const allFiles = fs.readdirSync(folderPath).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.tif', '.tiff'].includes(ext) && !f.startsWith('._');
    });
    
    const newFiles = [];
    for (const f of allFiles) {
      const candidateSlug = makeSlug(f, folder);
      if (!existingSlugs.has(candidateSlug)) {
        newFiles.push({ filename: f, filepath: path.join(folderPath, f) });
      }
    }
    
    if (newFiles.length === 0) {
      folderReports.push({ folder, gallery_id, slug, totals: { imported: 0, duplicates: allFiles.length, failed: 0 }, photo_results: [] });
      totalDupes += allFiles.length;
      continue;
    }
    
    const batch = newFiles.slice(0, BATCH_SIZE);
    let imported = 0, dupes = 0, failed = 0;
    
    for (const file of batch) {
      try {
        const slugStr = makeSlug(file.filename, folder);
        if (existingSlugs.has(slugStr)) { dupes++; continue; }
        
        const title = path.basename(file.filename, path.extname(file.filename)).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const meta = await sharp(file.filepath).metadata().catch(() => ({}));
        
        const result = await sql`
          INSERT INTO photos (title, slug, original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url, search_ready, ready_for_public_render, is_active, gallery_id, date_uploaded, uploaded_at)
          VALUES (${title}, ${slugStr}, '', '', '', '', '', '', true, true, true, ${gallery_id}, NOW(), NOW())
          RETURNING id
        `;
        const photoId = result[0].id;
        
        const origKey = await uploadOriginal(file.filepath, photoId);
        const derivs = await generateDerivatives(fs.readFileSync(file.filepath), photoId);
        
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
            width = ${meta.width || 0},
            height = ${meta.height || 0},
            uploaded_at = NOW(),
            date_modified = NOW()
          WHERE id = ${photoId}
        `;
        
        existingSlugs.add(slugStr);
        imported++;
        totalImported++;
        if (imported % 10 === 0) console.log(`  +${imported} in ${folder}`);
      } catch (e) {
        console.error(`  ERROR ${file.filename}: ${e.message}`);
        failed++;
        totalFailed++;
      }
    }
    
    totalDupes += (allFiles.length - batch.length);
    folderReports.push({ folder, gallery_id, slug, totals: { imported, duplicates: dupes + (allFiles.length - batch.length), failed }, photo_results: [] });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `/Users/joshuatenbrink/.openclaw/workspace/wild_import_batch_may2026_batch78_report_${timestamp}.json`;
  
  const report = {
    batch: 78,
    timestamp,
    folders: folderReports,
    totals: { imported: totalImported, duplicates: totalDupes, failed: totalFailed }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n=== BATCH 78 REPORT ===');
  console.log(`Folders processed: ${folderReports.length}`);
  for (const fr of folderReports) {
    console.log(`  ${fr.folder} (gallery_id=${fr.gallery_id}): +${fr.totals.imported} imported, ${fr.totals.duplicates} duplicates, ${fr.totals.failed} failed`);
  }
  console.log(`TOTAL: +${totalImported} imported, ${totalDupes} duplicates, ${totalFailed} failed`);
  console.log(`Report: ${reportPath}`);
  
  if (totalImported > 0) {
    console.log('\nSample outputs:');
    const samples = await sql`SELECT id, slug, title, gallery_id FROM photos WHERE is_active = true ORDER BY id DESC LIMIT 5`;
    for (const p of samples) console.log(`  ID ${p.id}: ${p.slug} | gallery_id=${p.gallery_id} | ${p.title}`);
    const gSample = await sql`SELECT slug, name FROM galleries WHERE id = ${folderReports[0].gallery_id}`;
    if (gSample.length) console.log(`  Gallery: ${gSample[0].slug} (${gSample[0].name})`);
    console.log(`  Sample photo URL: https://wildphotography.com/photo/${samples[0].slug}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
