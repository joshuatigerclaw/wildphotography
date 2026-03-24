#!/usr/bin/env npx tsx
/**
 * Regenerate missing derivatives from R2 originals (batch mode)
 */

import { neon } from '@neondatabase/serverless';
import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';

const NEON_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75';
const R2_SECRET_KEY = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f';
const R2_PUBLIC_URL = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

const dbPool = new Pool({
  host: 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
  database: 'wildphotography',
  user: 'neondb_owner',
  password: 'npg_BvF2JsQ8drba',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const SIZES: Record<string, { width: number; quality: number }> = {
  thumb: { width: 400, quality: 80 },
  small: { width: 900, quality: 85 },
  medium: { width: 1600, quality: 85 },
  large: { width: 2400, quality: 90 },
  web: { width: 1600, quality: 85 },
};

const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

async function getObject(key: string): Promise<Buffer | null> {
  try {
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const resp = await s3.send(cmd);
    if (!resp.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

async function objectExists(key: string): Promise<boolean> {
  try {
    const cmd = new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key });
    await s3.send(cmd);
    return true;
  } catch {
    return false;
  }
}

async function putObject(key: string, data: Buffer, contentType = 'image/jpeg'): Promise<boolean> {
  try {
    const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: data, ContentType: contentType });
    await s3.send(cmd);
    return true;
  } catch {
    return false;
  }
}

async function processPhoto(
  photo: { id: number; slug: string; original_r2_key: string },
): Promise<{ success: boolean; derivativesGenerated: number; uploadFailures: number; error?: string }> {
  const { id, slug, original_r2_key } = photo;

  const originalData = await getObject(original_r2_key);
  if (!originalData) {
    return { success: false, derivativesGenerated: 0, uploadFailures: 0, error: 'original_not_found' };
  }

  const derivatives: Record<string, { r2_key: string; public_url: string }> = {};
  let generated = 0;
  let failures = 0;

  for (const [sizeName, config] of Object.entries(SIZES)) {
    const r2Key = `derivatives/${sizeName}/${slug}-${sizeName}.jpg`;

    const exists = await objectExists(r2Key);
    if (exists) {
      derivatives[sizeName] = { r2_key: r2Key, public_url: `${R2_PUBLIC_URL}/${r2Key}` };
      generated++;
      console.log(`  [${sizeName}] Already exists, skipping`);
      continue;
    }

    try {
      const derivative = await sharp(originalData)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();

      const ok = await putObject(r2Key, derivative);
      if (ok) {
        derivatives[sizeName] = { r2_key: r2Key, public_url: `${R2_PUBLIC_URL}/${r2Key}` };
        generated++;
        console.log(`  [${sizeName}] Generated and uploaded (${derivative.length} bytes)`);
      } else {
        failures++;
        console.log(`  [${sizeName}] FAILED to upload`);
      }
    } catch (e: any) {
      failures++;
      console.log(`  [${sizeName}] Sharp error: ${e.message}`);
    }
  }

  if (generated === 0) {
    return { success: false, derivativesGenerated: 0, uploadFailures: failures, error: 'no_derivatives_generated' };
  }

  // Update database
  try {
    await dbPool.query(`
      UPDATE photos SET
        thumb_url = $1,
        small_url = $2,
        medium_url = $3,
        large_url = $4,
        preview_url = $5,
        r2_thumb_key = $6,
        r2_web_small_key = $7,
        r2_web_large_key = $8,
        derivatives_complete = true,
        ready_for_public_render = true,
        search_ready = true,
        updated_at = NOW()
      WHERE id = $9
    `, [
      derivatives['thumb']?.public_url || '',
      derivatives['small']?.public_url || '',
      derivatives['medium']?.public_url || '',
      derivatives['large']?.public_url || '',
      derivatives['web']?.public_url || '',
      derivatives['thumb']?.r2_key || '',
      derivatives['small']?.r2_key || '',
      derivatives['large']?.r2_key || '',
      id,
    ]);
    return { success: true, derivativesGenerated: generated, uploadFailures: failures };
  } catch (e: any) {
    return { success: false, derivativesGenerated: generated, uploadFailures: failures, error: `db_error: ${e.message}` };
  }
}

async function main() {
  const batchLimit = parseInt(process.argv[2] || '50');

  console.log(`=== WildPhotography R2 Derivative Regeneration Batch ===`);
  console.log(`Batch limit: ${batchLimit}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const sql = neon(NEON_CONNECTION);

  const photos = await sql(`
    SELECT id, slug, original_r2_key
    FROM photos
    WHERE derivatives_complete = false
      AND original_r2_key IS NOT NULL
      AND original_r2_key != ''
      AND status != 'archived_unrecoverable'
    LIMIT ${batchLimit}
  `);

  console.log(`Found ${photos.length} photos needing derivative regeneration\n`);

  if (photos.length === 0) {
    console.log('No photos to process');
    await dbPool.end();
    return;
  }

  let success = 0;
  let failed = 0;
  let totalDerivatives = 0;
  let totalFailures = 0;
  const failureList: Array<{ id: number; slug: string; error: string }> = [];

  for (const photo of photos) {
    process.stdout.write(`[${photo.id}] ${photo.slug}... `);
    const result = await processPhoto(photo);

    if (result.success) {
      success++;
      totalDerivatives += result.derivativesGenerated;
      console.log(`OK (${result.derivativesGenerated} derivs)`);
    } else {
      failed++;
      totalFailures += result.uploadFailures;
      failureList.push({ id: photo.id, slug: photo.slug, error: result.error || 'unknown' });
      console.log(`FAILED: ${result.error}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Records processed: ${photos.length}`);
  console.log(`Records successful: ${success}`);
  console.log(`Records failed: ${failed}`);
  console.log(`Derivatives generated: ${totalDerivatives}`);
  console.log(`Upload failures: ${totalFailures}`);
  if (failureList.length > 0) {
    console.log(`\nFailed records:`);
    failureList.forEach(f => console.log(`  - ${f.id} (${f.slug}): ${f.error}`));
  }
  console.log(`\nCompleted: ${new Date().toISOString()}`);

  await dbPool.end();
}

main().catch(console.error);
