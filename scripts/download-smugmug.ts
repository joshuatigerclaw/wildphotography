/**
 * SmugMug Downloader + Resizer
 * 
 * Gets full-resolution images from SmugMug, resizes, uploads to R2
 */

import Sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import got from 'got';
import crypto from 'crypto';

// Config
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

// Use environment variables
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET = process.env.R2_SECRET_KEY || '';

// SmugMug OAuth - need to get these working
const SMUGMUG_API_KEY = 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const SMUGMUG_SECRET = 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp';
const ACCESS_TOKEN = '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8';
const ACCESS_SECRET = 'V5Ggv3kvtffLpxqBjXP5HMQgrZHPfRfFP8c2sfdkTmdkrBD4Qx5ZZLgPQJzHR4LP';

// OAuth signing (simplified)
function createOAuthHeader(url: string, method: string): string {
  const oauthParams = {
    oauth_consumer_key: SMUGMUG_API_KEY,
    oauth_token: ACCESS_TOKEN,
    oauth_nonce: crypto.randomBytes(8).toString('hex'),
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_version: '1.0',
  };
  
  // Create signature base
  const base = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(oauthParams).sort().map(([k, v]) => `${k}=${v}`).join('&')
  )}`;
  
  // HMAC-SHA1 signature
  const key = `${SMUGMUG_SECRET}&${ACCESS_SECRET}`;
  const signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  oauthParams.oauth_signature = signature;
  
  const authHeader = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ');
    
  return authHeader;
}

// R2 Client
const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET },
});

const SIZES = {
  thumb: { width: 400, suffix: 'thumb', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 85 },
  large: { width: 2800, suffix: 'large', quality: 90 },
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
    console.error('Upload error:', e.message);
    return false;
  }
}

async function getSmugMugImage(imageKey: string): Promise<Buffer | null> {
  try {
    // Try to get the image download URL
    const url = `https://api.smugmug.com/api/v2/image/${imageKey}`;
    const auth = createOAuthHeader(url, 'GET');
    
    const response = await got(url, {
      headers: {
        'Authorization': auth,
        'Accept': 'application/json',
      },
    });
    
    const data = JSON.parse(response.body);
    const imageUri = data.Response?.Image?.Uri;
    
    if (!imageUri) {
      console.log('No URI found, trying alternative...');
      // Try to get the largest available size
      const largest = data.Response?.Image?.ArchivedUri || data.Response?.Image?.Uri;
      if (largest) {
        const imgResp = await got(largest, { headers: { 'Authorization': auth } });
        return Buffer.from(imgResp.body);
      }
      return null;
    }
    
    // Download the image
    const imgResponse = await got(imageUri, { encoding: null });
    return Buffer.from(imgResponse.body);
  } catch (e) {
    console.error('SmugMug error:', e.message);
    return null;
  }
}

async function processImage(imageKey: string, slug: string): Promise<void> {
  console.log(`\n=== ${slug} ===`);
  
  const original = await getSmugMugImage(imageKey);
  if (!original) {
    console.log('  Could not get image');
    return;
  }
  
  console.log(`  Original: ${original.length} bytes`);
  
  for (const [size, config] of Object.entries(SIZES)) {
    try {
      const resized = await Sharp(original)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      
      const key = `derivatives/${size}/${slug}-${config.suffix}.jpg`;
      await upload(key, resized);
      console.log(`  ${size}: ${resized.length} bytes`);
    } catch (e) {
      console.error(`  ${size} error:`, e.message);
    }
  }
}

// Main
const args = process.argv.slice(2);
const imageKey = args[0] || 'img_9761';
const slug = args[1] || 'img-9761-jpg-McvJMD';

processImage(imageKey, slug)
  .then(() => console.log('\nDone'))
  .catch(console.error);
