/**
 * Generate derivatives from existing originals in R2
 * 
 * Reads originals from R2, generates thumb/small/medium/large,
 * uploads back to R2, and updates DB with correct keys.
 */

import { neon } from '@neondatabase/serverless';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const NEON_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_ACCESS_KEY = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_SECRET_KEY = 'VcSgOA9VsIcjE85VD1nAKiAMenj-1SB255hsnvE0';
const R2_PUBLIC_URL = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

const sql = neon(NEON_CONNECTION);
const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

const SIZES = {
  thumb: { width: 400, suffix: 'thumb' },
  small: { width: 900, suffix: 'small' },
  medium: { width: 1600, suffix: 'medium' },
  large: { width: 2400, suffix: 'large' },
};

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
  } catch (e: any) {
    console.log(`[getObject] ${key}: ${e.message}`);
    return null;
  }
}

async function putObject(key: string, data: Buffer, contentType: string): Promise<boolean> {
  try {
    const cmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    await s3.send(cmd);
    return true;
  } catch (e: any) {
    console.log(`[putObject] ${key}: ${e.message}`);
    return false;
  }
}

async function processPhoto(id: number, originalKey: string, slug: string) {
  console.log(`\n=== Processing ${slug} ===`);
  console.log(`Original: ${originalKey}`);
  
  // Get original from R2
  const originalData = await getObject(originalKey);
  if (!originalData) {
    console.log(`ERROR: Original not found in R2`);
    return false;
  }
  
  console.log(`Got original: ${originalData.length} bytes`);
  
  let lastKey = '';
  
  // Generate each size
  for (const [sizeName, config] of Object.entries(SIZES)) {
    const key = `derivatives/${sizeName}s/${slug}-${config.suffix}.jpg`;
    lastKey = key;
    
    // Check if already exists
    const existing = await getObject(key);
    if (existing) {
      console.log(`[${sizeName}] Already exists, skipping`);
      continue;
    }
    
    // Generate derivative
    try {
      const derivative = await sharp(originalData)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      // Upload
      const ok = await putObject(key, derivative, 'image/jpeg');
      if (ok) {
        console.log(`[${sizeName}] Uploaded: ${key} (${derivative.length} bytes)`);
      } else {
        console.log(`[${sizeName}] FAILED to upload`);
      }
    } catch (e: any) {
      console.log(`[${sizeName}] Sharp error: ${e.message}`);
    }
  }
  
  return true;
}

async function main() {
  console.log('=== Generating Derivatives ===\n');
  
  // Get photos with originals but missing derivatives
  const photos = await sql(`
    SELECT p.id, p.slug, p.original_r2_key, p.thumb_url
    FROM photos p
    WHERE p.original_r2_key IS NOT NULL 
      AND p.original_r2_key != ''
      AND (p.thumb_url IS NULL OR p.thumb_url = '')
    LIMIT 20
  `);
  
  console.log(`Found ${photos.length} photos needing derivatives\n`);
  
  for (const photo of photos) {
    await processPhoto(photo.id, photo.original_r2_key, photo.slug);
  }
  
  console.log('\n=== Done ===');
}

main().catch(console.error);
