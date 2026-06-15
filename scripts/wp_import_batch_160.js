/**
 * WildPhotography Import Batch 160
 * Targeted: Unmapped folders with real content + resume Beaches gap
 * Cron trigger: f6c6a1a4-33d1-4af5-9102-08224ab54372
 */
const fs = require('fs');
const path = require('path');
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

const BATCH_LIMIT = 50;
const r2 = new S3Client({ endpoint: R2_ENDPOINT, region: 'auto', credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_ACCESS_SECRET } });
const sql = neon(NEON_DB);

const SIZES = {
  thumb:   { width: 400,  folder: 'thumbs',   suffix: 'thumb',   quality: 80 },
  small:   { width: 900,  folder: 'smalls',   suffix: 'small',   quality: 85 },
  medium:  { width: 1600, folder: 'mediums',  suffix: 'medium',  quality: 85 },
  large:   { width: 2400, folder: 'larges',   suffix: 'large',   quality: 90 },
  preview: { width: 2800, folder: 'previews', suffix: 'preview', quality: 92 },
};

function dirToSlug(d) { return d.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); }
function makeSlug(filename, folder) {
  const base = path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${base}-${dirToSlug(folder)}`;
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
  console.log('=== WildPhotography Import Batch 160 ===');
  console.log('Time:', new Date().toISOString());

  const existingRows = await sql`SELECT slug FROM photos WHERE is_active = true`;
  const existingSlugs = new Set(existingRows.map(r => r.slug));
  console.log('Existing slugs:', existingSlugs.size);

  const galleryRows = await sql`SELECT slug, id FROM galleries WHERE is_active = true`;
  const galleryMap = new Map(galleryRows.map(r => [r.slug, r.id]));
  console.log('Galleries:', galleryMap.size);

  const folderTargets = [
    { folder: 'Food-', targetSlug: 'food' },
    { folder: 'Beaches', targetSlug: 'beaches' },
    { folder: 'Tarcoles-', targetSlug: 'crocodiles' },
    { folder: 'The-Environment-', targetSlug: 'the-environment' },
  ];

  let totalNew = 0, totalDupes = 0, totalErrors = 0;
  const reports = [];

  for (const target of folderTargets) {
    const folderPath = path.join(ROOT, target.folder);
    if (!fs.existsSync(folderPath)) {
      console.log(`SKIP ${target.folder}: not found`);
      continue;
    }
    const galleryId = galleryMap.get(target.targetSlug);
    if (!galleryId) {
      console.log(`SKIP ${target.folder}: gallery "${target.targetSlug}" not found`);
      continue;
    }
    const allFiles = fs.readdirSync(folderPath).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png'].includes(ext) && !f.startsWith('._');
    });
    const newFiles = allFiles.filter(f => !existingSlugs.has(makeSlug(f, target.folder)));
    console.log(`\n${target.folder} → ${target.targetSlug} (gallery_id=${galleryId}): disk=${allFiles.length}, new=${newFiles.length}`);

    if (newFiles.length === 0) {
      reports.push({ folder: target.folder, imported: 0, duplicates: allFiles.length, errors: 0 });
      totalDupes += allFiles.length;
      continue;
    }

    const batch = newFiles.slice(0, BATCH_LIMIT);
    let imported = 0, dupes = 0, errors = 0;

    for (const filename of batch) {
      const slugStr = makeSlug(filename, target.folder);
      if (existingSlugs.has(slugStr)) { dupes++; continue; }
      try {
        const filePath = path.join(folderPath, filename);
        const title = path.basename(filename, path.extname(filename)).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const meta = await sharp(filePath).metadata().catch(() => ({}));

        const result = await sql`
          INSERT INTO photos (title, slug, original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url, search_ready, ready_for_public_render, is_active, gallery_id, date_uploaded, uploaded_at)
          VALUES (${title}, ${slugStr}, '', '', '', '', '', '', true, true, true, ${galleryId}, NOW(), NOW())
          RETURNING id
        `;
        const photoId = result[0].id;
        const origKey = await uploadOriginal(filePath, photoId);
        const derivs = await generateDerivatives(fs.readFileSync(filePath), photoId);

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
            derivatives_complete = true,
            uploaded_at = NOW(),
            date_modified = NOW()
          WHERE id = ${photoId}
        `;

        existingSlugs.add(slugStr);
        imported++;
        totalNew++;
        if (imported % 10 === 0) console.log(`  +${imported} in ${target.folder} (gallery_id=${galleryId})`);
      } catch (e) {
        console.error(`  ERROR ${filename}: ${e.message.substring(0, 100)}`);
        errors++;
        totalErrors++;
      }
    }

    totalDupes += (allFiles.length - batch.length);
    reports.push({ folder: target.folder, gallery: target.targetSlug, gallery_id: galleryId, imported, duplicates: dupes + (allFiles.length - batch.length), errors });
    console.log(`  → ${imported} imported, ${dupes + (allFiles.length - batch.length)} duplicates, ${errors} errors`);
  }

  console.log('\n=== BATCH 160 SUMMARY ===');
  console.log(`New imports: ${totalNew} | Duplicates: ${totalDupes} | Errors: ${totalErrors}`);
  for (const r of reports) {
    console.log(`  ${r.folder} → ${r.gallery}: +${r.imported} imported, ${r.duplicates} dupes, ${r.errors} errors`);
  }
  if (totalNew > 0) {
    const recent = await sql`SELECT id, slug, gallery_id, title FROM photos WHERE is_active = true ORDER BY id DESC LIMIT 5`;
    console.log('\nMost recent photos:');
    recent.forEach(p => console.log(`  ${p.id} | gallery_id=${p.gallery_id} | ${p.slug.substring(0,40)} | ${p.title}`));
  }
  console.log('\nBatch 160 complete. ' + totalNew + ' new photos imported.');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });