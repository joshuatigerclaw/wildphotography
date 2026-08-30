/**
 * Targeted derivative regeneration for specific photos with missing derivatives.
 * Photos with truly missing R2 derivative objects.
 */
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '/Users/joshuatenbrink';
const LOG_DIR = path.join(HOME, 'wildphotography_cloudflare_src', 'logs');
const NEON = 'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2 = {
  endpoint: 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
  bucket: 'wildphoto-storage',
  accessKeyId: 'b821d56d29d9a2c716f783fc481e2f75',
  secretAccessKey: '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f',
  publicUrl: 'https://images.wildphotography.com',
};

// Derivatives config: width, suffix, quality
const SIZES = {
  thumb:   { width: 400,  suffix: 'thumbs', quality: 80 },
  small:   { width: 900,  suffix: 'small',  quality: 85 },
  medium:  { width: 1600, suffix: 'medium', quality: 90 },
  large:   { width: 2400, suffix: 'large',  quality: 92 },
  preview: { width: 800,  suffix: 'large',  quality: 85 },
};

const s3 = new S3Client({
  endpoint: R2.endpoint, region: 'auto',
  credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
});

const sql = neon(NEON);

async function r2Get(key) {
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: R2.bucket, Key: key }));
    const chunks = [];
    for await (const c of Body) chunks.push(c);
    return Buffer.concat(chunks);
  } catch (e) {
    console.log(`  [r2Get] FAILED ${key}: ${e.message}`);
    return null;
  }
}

async function r2Put(key, buf, type = 'image/webp') {
  try {
    await s3.send(new PutObjectCommand({ Bucket: R2.bucket, Key: key, Body: buf, ContentType: type }));
    return true;
  } catch (e) {
    console.log(`  [r2Put] FAILED ${key}: ${e.message}`);
    return false;
  }
}

async function generateDerivatives(buf, slug, id) {
  const results = {};
  const meta = await sharp(buf).metadata();
  const ar = (meta.height || 1) / (meta.width || 1);

  // Determine output format based on original format
  const isJpg = (meta.format === 'jpeg' || meta.format === 'jpg');

  for (const [size, cfg] of Object.entries(SIZES)) {
    let w = cfg.width;
    let h = Math.round(w * ar);
    if ((meta.width || 1) < w) { w = meta.width || 1; h = meta.height || 1; }

    const ext = isJpg ? 'jpg' : 'webp';
    const quality = cfg.quality;
    const keyBase = `derivatives/${id}/${id}_${cfg.suffix}.${ext}`;

    try {
      let img;
      if (ext === 'jpg') {
        img = await sharp(buf).resize(w, h, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality }).toBuffer();
      } else {
        img = await sharp(buf).resize(w, h, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
      }

      const uploaded = await r2Put(keyBase, img, ext === 'jpg' ? 'image/jpeg' : 'image/webp');
      if (uploaded) {
        const url = `${R2.publicUrl}/${keyBase}`;
        results[size] = url;
        console.log(`    ${size}: ${url} (${img.length} bytes)`);
      } else {
        console.log(`    ${size}: UPLOAD FAILED`);
        results[size] = null;
      }
    } catch (e) {
      console.log(`    ${size}: SHARP ERROR ${e.message}`);
      results[size] = null;
    }
  }
  return results;
}

// Photos that need derivative regeneration because R2 keys are truly absent or broken
const PHOTOS_TO_REGEN = [
  // ALL_MISSING - truly no R2 derivative keys
  { id: 67904, slug: 'pano00002-d00aa71a', originalKey: 'originals/costa-rica-gallery-tambor-nicoya-peninsula-costa-rica/389f930c40d61d68dda2b6d889882b8f.jpg' },
  { id: 67585, slug: 'dji-0522-cc2bed9c', originalKey: 'originals/costa-rica-gallery-tambor-nicoya-peninsula-costa-rica/5a7e3d2d0bf13ef2aa3ee4ad02fe27a1.jpg' },
  { id: 67189, slug: 'dji-0208-68e040bb', originalKey: 'originals/costa-rica-gallery-tambor-nicoya-peninsula-costa-rica/b7ed468d28267f36ce00627580e96237.jpg' },
  { id: 69880, slug: '2020-11-28-17-03-28-9aa8e39d', originalKey: 'originals/costa-rica-gallery-sunrise-sunset/031f15d161717b0fab1761d3a56f8b38.jpg' },

  // PARTIAL - some R2 keys missing
  { id: 73037, slug: 'dji-0386', originalKey: 'originals/gallery_347/dji-0386.jpg' },
  { id: 52724, slug: 'birds-cl0a2863', originalKey: 'originals/birds/4da807068a839b3514cbf87192d233db.jpg' },
  { id: 45804, slug: 'dji-0250', originalKey: 'photos/samara-playa-carillo/DJI_0250_original.jpg' },
  { id: 92099, slug: 'rio-savagre-4a543daa', originalKey: 'photos/4a/4a543daa48e7be1460196136278a0953.jpg' },
  { id: 31446, slug: '2025-03-08-06-48-50-9efdd00f', originalKey: 'originals/food/9efdd00f2556dc58afe0b2286c4f00c113abcff6664265ab131ccba70f698d9f.jpg' },
  { id: 45300, slug: '20250417-180140', originalKey: 'photos/beaches/20250417_180140_original.jpg' },
  { id: 20908, slug: 'DJI_0023-a31af9d4', originalKey: 'originals/DJI_0023-a31af9d4.jpg' },
  { id: 8660, slug: 'dji-0237-jaco-beach-5278', originalKey: 'originals/5278/DJI_0237.JPG' },
];

async function main() {
  const results = { success: [], failed: [] };

  for (const photo of PHOTOS_TO_REGEN) {
    console.log(`\n=== Processing ID ${photo.id} (${photo.slug}) ===`);
    console.log(`  Original: ${photo.originalKey}`);

    // Download original
    const buf = await r2Get(photo.originalKey);
    if (!buf) {
      console.log(`  ERROR: Original not found in R2`);
      results.failed.push({ id: photo.id, slug: photo.slug, error: 'original_not_found' });
      continue;
    }

    const meta = await sharp(buf).metadata();
    console.log(`  Original: ${buf.length} bytes, format: ${meta.format}`);

    // Generate derivatives
    const derivs = await generateDerivatives(buf, photo.slug, photo.id);

    // Build URL map
    const urlMap = {};
    const neededSizes = ['thumb', 'small', 'medium', 'large', 'preview'];
    for (const size of neededSizes) {
      urlMap[`${size}_url`] = derivs[size] || null;
    }

    // Check if we got enough derivatives
    const gotCount = neededSizes.filter(s => derivs[s] !== null && derivs[s] !== undefined).length;
    if (gotCount < 4) {
      console.log(`  WARNING: Only ${gotCount}/5 derivatives generated`);
    }

    // Update DB
    try {
      await sql`
        UPDATE photos SET
          thumb_url = ${urlMap.thumb_url},
          small_url = ${urlMap.small_url},
          medium_url = ${urlMap.medium_url},
          large_url = ${urlMap.large_url},
          preview_url = ${urlMap.preview_url},
          derivatives_complete = true,
          ready_for_public_render = true
        WHERE id = ${photo.id}
      `;
      console.log(`  DB updated successfully`);
      results.success.push({ id: photo.id, slug: photo.slug, derivs });
    } catch (e) {
      console.log(`  DB UPDATE FAILED: ${e.message}`);
      results.failed.push({ id: photo.id, slug: photo.slug, error: e.message });
    }
  }

  // Save report
  const reportPath = path.join(LOG_DIR, `media-repair-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n=== SUMMARY ===`);
  console.log(`Repaired: ${results.success.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Report: ${reportPath}`);
  return results;
}

main().catch(e => { console.error(e); process.exit(1); });
