/**
 * SmugMug Import Script
 * 
 * Downloads photos from SmugMug, generates derivatives, uploads to R2
 */

import Sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import got from 'got';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// Config
const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

// SmugMug credentials
const SMUGMUG_API_KEY = process.env.SMUGMUG_API_KEY || '6hJGBgm49JsxZhWnBm3vMFcKnH5tbSd9';
const SMUGMUG_API_SECRET = process.env.SMUGMUG_API_SECRET || 'MMD4PRS7x52DSW44jjQHNv9FfqN22RwJf8p8XHWFnjcSkkMwGxHGmcw4DwTcHChs';
const ACCESS_TOKEN = process.env.SMUGMUG_ACCESS_TOKEN || '244ntqLqM8gZ38MKrbM67QPdgsws2T7x';
const ACCESS_SECRET = process.env.SMUGMUG_ACCESS_SECRET || '3BdZpBsttNX5rsw94H6Q38CxB4t4NS9pfJDdzJ5GXXxp5F6MN4bcBdjHcfrB67rZ';

// Neon
const NEON_URL = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// R2 client
const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || '3ec62f93675c404fe4a9a4949e38e5e5',
    secretAccessKey: process.env.R2_SECRET_KEY || '',
  },
});

const sql = neon(NEON_URL);

const SIZES = {
  thumb: { width: 400, suffix: 'thumb', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 85 },
  large: { width: 2400, suffix: 'large', quality: 90 },
};

// Simple OAuth for SmugMug
function createOAuthHeader(url: string, method: string): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const params = [
    `oauth_consumer_key=${SMUGMUG_API_KEY}`,
    `oauth_token    `oauth_n=${ACCESS_TOKEN}`,
once=${nonce}`,
    `oauth_timestamp=${timestamp}`,
    `oauth_signature_method=HMAC-SHA1`,
    `oauth_version=1.0`
  ].sort().join('&');
  
  const base = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(params)}`;
  const key = `${SMUGMUG_API_SECRET}&${ACCESS_SECRET}`;
  const signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  
  return `OAuth oauth_consumer_key="${SMUGMUG_API_KEY}", oauth_token="${ACCESS_TOKEN}", oauth_nonce="${nonce}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${timestamp}", oauth_version="1.0", oauth_signature="${signature}"`;
}

async function getAlbumImages(albumKey: string): Promise<any[]> {
  const url = `https://api.smugmug.com/api/v2/album/${albumKey}!images`;
  const auth = createOAuthHeader(url, 'GET');
  
  const response = await got(url, {
    headers: { 
      'Authorization': auth,
      'Accept': 'application/json'
    }
  });
  
  const data = JSON.parse(response.body);
  return data.Response.AlbumImage || [];
}

async function getLargestImageUrl(imageKey: string): Promise<string | null> {
  // The album images already contain a lot of info, but to get the largest image we need another call
  // For now, we'll use the thumbnail as a fallback
  return null;
}

async function uploadToR2(key: string, data: Buffer): Promise<boolean> {
  try {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: 'image/jpeg',
    }));
    return true;
  } catch (e) {
    console.error('[R2] Upload error:', e.message);
    return false;
  }
}

async function generateDerivatives(original: Buffer, slug: string): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  for (const [size, config] of Object.entries(SIZES)) {
    try {
      const resized = await Sharp(original)
        .resize(config.width, null, { withoutEnlargement: true })
        .jpeg({ quality: config.quality })
        .toBuffer();
      
      const key = `derivatives/${size}s/${slug}-${config.suffix}.jpg`;
      const url = `${R2_PUBLIC}/derivatives/${size}s/${slug}-${config.suffix}.jpg`;
      
      const uploaded = await uploadToR2(key, resized);
      if (uploaded) {
        results[`${size}_url`] = url;
        console.log(`  ${size}: ${resized.length} bytes`);
      }
    } catch (e) {
      console.error(`  ${size} error:`, e.message);
    }
  }
  
  return results;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function importAlbum(albumName: string, albumKey: string, gallerySlug: string): Promise<void> {
  console.log(`\n=== Importing: ${albumName} ===`);
  
  const images = await getAlbumImages(albumKey);
  console.log(`Found ${images.length} images`);
  
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const title = img.FileName || `Photo ${img.Serial}`;
    const slug = slugify(title) + '-' + img.ImageKey.slice(0, 6);
    
    console.log(`\n[${i+1}/${images.length}] ${title}`);
    
    // Check if already imported
    const existing = await sql`SELECT slug FROM photos WHERE slug = ${slug}`;
    if (existing.length > 0) {
      console.log('  Already imported, skipping');
      continue;
    }
    
    // For now, we don't have direct download URLs from the list
    // Need to make another API call to get the largest image URL
    console.log('  (Image download requires additional API call - skipped for now)');
  }
}

async function main() {
  // Import Surfing Costa Rica album
  await importAlbum('Surfing Costa Rica', 'ZXn2L5', 'surfing-costa-rica');
  
  console.log('\n=== Import complete ===');
}

main().catch(console.error);
