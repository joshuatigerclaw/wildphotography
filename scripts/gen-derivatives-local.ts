/**
 * Quick Derivative Generator from Local Files
 * 
 * Resizes local full-res images and uploads to R2
 */

import Sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';

// Config
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: '3ec62f93675c404fe4a9a4949e38e5e5',
    secretAccessKey: process.env.R2_SECRET_KEY || '',
  },
});

const SIZES = {
  thumb: { width: 400, suffix: 'thumb', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 85 },
  large: { width: 2400, suffix: 'large', quality: 90 },
};

async function upload(key: string, data: Buffer): Promise<boolean> {
  try {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: 'image/jpeg',
    }));
    return true;
  } catch (e) {
    console.error('Error:', e.message);
    return false;
  }
}

async function processFile(inputPath: string, slug: string): Promise<void> {
  console.log(`\n=== Processing: ${slug} ===`);
  
  const original = readFileSync(inputPath);
  console.log(`Original: ${(original.length / 1024 / 1024).toFixed(2)} MB`);
  
  for (const [size, config] of Object.entries(SIZES)) {
    const resized = await Sharp(original)
      .resize(config.width, null, { withoutEnlargement: true })
      .jpeg({ quality: config.quality })
      .toBuffer();
    
    const key = `derivatives/${size}/${slug}-${config.suffix}.jpg`;
    await upload(key, resized);
    console.log(`  ${size}: ${(resized.length / 1024).toFixed(1)} KB`);
  }
}

async function main() {
  await processFile('./hermosa1.jpg', 'hermosa-beach-1');
  await processFile('./hermosa2.jpg', 'hermosa-beach-2');
  console.log('\nDone!');
}

main().catch(console.error);
