/**
 * Quick fix: Copy originals to derivatives
 * This is a workaround - real solution is to generate resized derivatives
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_ACCESS_KEY = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_SECRET_KEY = 'VcSgOA9VsIcjE85VD1nAKiAMenj-1SB255hsnvE0';

const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

async function copyToDerivative(originalKey: string, size: 'thumbs' | 'small' | 'medium' | 'large', slug: string): Promise<boolean> {
  const suffix = size === 'thumbs' ? 'thumb' : size;
  const derivativeKey = `derivatives/${size}/${slug}-${suffix}.jpg`;
  
  try {
    // Get original
    const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: originalKey });
    const resp = await s3.send(getCmd);
    
    if (!resp.Body) {
      console.log(`[${size}] No body for ${originalKey}`);
      return false;
    }
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as any) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    
    // Upload to derivative path
    const putCmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: derivativeKey,
      Body: data,
      ContentType: 'image/jpeg',
    });
    await s3.send(putCmd);
    
    console.log(`[${size}] Copied ${originalKey} -> ${derivativeKey} (${data.length} bytes)`);
    return true;
  } catch (e: any) {
    console.log(`[${size}] Error: ${e.message}`);
    return false;
  }
}

async function main() {
  const originals = [
    { original: 'originals/img_9761.jpg', slug: 'img_9761' },
    { original: 'originals/img_9867.jpg', slug: 'img_9867' },
    { original: 'originals/img_0133.jpg', slug: 'img_0133' },
    { original: 'originals/img_0135.jpg', slug: 'img_0135' },
    { original: 'originals/img', slug: '_0143.jpgimg_0143' },
    { original: 'originals/img_0148.jpg', slug: 'img_0148' },
    { original: 'originals/img_0154.jpg', slug: 'img_0154' },
    { original: 'originals/img_9919.jpg', slug: 'img_9919' },
    { original: 'originals/img_2084.jpg', slug: 'img_2084' },
    { original: 'originals/img_3491.jpg', slug: 'img_3491' },
  ];
  
  console.log('=== Copying originals to derivatives ===\n');
  
  for (const item of originals) {
    console.log(`\n--- ${item.slug} ---`);
    await copyToDerivative(item.original, 'thumbs', item.slug);
    await copyToDerivative(item.original, 'small', item.slug);
    await copyToDerivative(item.original, 'medium', item.slug);
    await copyToDerivative(item.original, 'large', item.slug);
  }
  
  console.log('\n=== Done ===');
}

main().catch(console.error);
