/**
 * Local Derivative Generator
 * 
 * Reads local full-res images, resizes with Sharp, uploads to R2
 */

import Sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';

// Config
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_SECRET = process.env.R2_SECRET_KEY || '';

// R2 Client
const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET },
});

// Derivative sizes
const SIZES = {
  thumb: { width: 400, suffix: 'thumb', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 85 },
  large: { width: 2800, suffix: 'large', quality: 90 },
};

async function uploadDerivative(key: string, data: Buffer): Promise<boolean> {
  try {
    const cmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: 'image/jpeg',
    });
    await r2.send(cmd);
    return true;
  } catch (e) {
    console.error('[error] Uploading:', e.message);
    return false;
  }
}

async function processFile(localPath: string, slug: string): Promise<void> {
  console.log(`\n=== Processing: ${slug} ===`);
  console.log(`  Source: ${localPath}`);
  
  const original = readFileSync(localPath);
  console.log(`  Original size: ${original.length} bytes`);
  
  for (const [size, config] of Object.entries(SIZES)) {
    try {
      const resized = await Sharp(original)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      
      const key = `derivatives/${size}/${slug}-${config.suffix}.jpg`;
      
      const uploaded = await uploadDerivative(key, resized);
      if (uploaded) {
        console.log(`  ${size}: ${resized.length} bytes`);
      }
    } catch (e) {
      console.error(`  ${size} error:`, e.message);
    }
  }
}

// Test with our local files
const testFiles = [
  { local: './hermosa1.jpg', slug: 'hermosa-beach-1' },
  { local: './hermosa2.jpg', slug: 'hermosa-beach-2' },
];

async function main() {
  for (const f of testFiles) {
    await processFile(f.local, f.slug);
  }
  console.log('\nDone!');
}

main().catch(console.error);
