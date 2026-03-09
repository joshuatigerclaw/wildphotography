/**
 * Proper Derivative Generator
 * 
 * Downloads original from SmugMug, resizes with Sharp, uploads to R2
 */

import Sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import got from 'got';

// Config
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_SECRET = process.env.R2_SECRET_KEY || '';

const SMUGMUG_API_KEY = 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const SMUGMUG_SECRET = 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp';
const SMUGMUG_ACCESS_TOKEN = '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8';
const SMUGMUG_TOKEN_SECRET = 'V5Ggv3kvtffLpxqBjXP5HMQgrZHPfRfFP8c2sfdkTmdkrBD4Qx5ZZLgPQJzHR4LP';

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

async function getOriginalFromSmugMug(imageKey: string): Promise<Buffer | null> {
  try {
    // Get image from SmugMug
    const url = `https://api.smugmug.com/api/v2/image/${imageKey}!download`;
    
    const response = await got(url, {
      headers: {
        'Authorization': `OAuth oauth_token=${SMUGMUG_ACCESS_TOKEN}, oauth_token_secret=${SMUGMUG_TOKEN_SECRET}`,
        'api_key': SMUGMUG_API_KEY,
      },
    });
    
    return Buffer.from(response.body);
  } catch (e) {
    console.error('[error] Getting original:', e.message);
    return null;
  }
}

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

async function generateAndUpload(imageKey: string, slug: string): Promise<void> {
  console.log(`\n=== Processing: ${slug} ===`);
  
  // Get original
  const original = await getOriginalFromSmugMug(imageKey);
  if (!original) {
    console.log('  Could not get original, skipping...');
    return;
  }
  
  console.log(`  Original size: ${original.length} bytes`);
  
  // Generate each size
  for (const [size, config] of Object.entries(SIZES)) {
    try {
      const resized = await Sharp(original)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      
      const key = `derivatives/${size}/${slug}-${config.suffix}.jpg`;
      const url = `${R2_PUBLIC}/${key}`;
      
      const uploaded = await uploadDerivative(key, resized);
      if (uploaded) {
        console.log(`  ${size}: ${resized.length} bytes -> ${url}`);
      }
    } catch (e) {
      console.error(`  ${size} error:`, e.message);
    }
  }
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/regenerate-derivatives.js <imageKey> <slug>');
  console.log('Example: node scripts/regenerate-derivatives.js img_9761 img-9761-jpg-McvJMD');
  process.exit(1);
}

const imageKey = args[0];
const slug = args[1];

generateAndUpload(imageKey, slug)
  .then(() => console.log('\nDone!'))
  .catch(e => console.error('Error:', e));
