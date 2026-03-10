/**
 * SmugMug Import Pipeline - Stage 2: Original Download
 * 
 * Downloads original images from SmugMug and stores in R2 privately
 * Idempotent: checks if already downloaded before re-downloading
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import type { Env } from '../types';

const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';

const SMUGMUG_API_KEY = '6hJGBgm49JsxZhWnBm3vMFcKnH5tbSd9';
const SMUGMUG_API_SECRET = 'MMD4PRS7x52DSW44jjQHNv9FfqN22RwJf8p8XHWFnjcSkkMwGxHGmcw4DwTcHChs';
const ACCESS_TOKEN = '244ntqLqM8gZ38MKrbM67QPdgsws2T7x';
const ACCESS_SECRET = '3BdZpBsttNX5rsw94H6Q38CxB4t4NS9pfJDdzJ5GXXxp5F6MN4bcBdjHcfrB67rZ';

// Rate limit state
let rateLimitRemaining = 100;
let rateLimitReset = Date.now() + 60000;
const RATE_LIMIT_BUFFER = 5;

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: '3ec62f93675c404fe4a9a4949e38e5e5',
    secretAccessKey: '',
  },
});

function createOAuthHeader(url: string): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const params = [
    `oauth_consumer_key=${SMUGMUG_API_KEY}`,
    `oauth_token=${ACCESS_TOKEN}`,
    `oauth_nonce=${nonce}`,
    `oauth_timestamp=${timestamp}`,
    `oauth_signature_method=HMAC-SHA1`,
    `oauth_version=1.0`
  ].sort().join('&');
  
  const base = `GET&${encodeURIComponent(url)}&${encodeURIComponent(params)}`;
  const key = `${SMUGMUG_API_SECRET}&${ACCESS_SECRET}`;
  const signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  
  return `OAuth oauth_consumer_key="${SMUGMUG_API_KEY}", oauth_token="${ACCESS_TOKEN}", oauth_nonce="${nonce}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${timestamp}", oauth_version="1.0", oauth_signature="${signature}"`;
}

async function waitForRateLimit(response: Response): Promise<void> {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  const retryAfter = response.headers.get('Retry-After');
  
  if (remaining) rateLimitRemaining = parseInt(remaining, 10);
  if (reset) rateLimitReset = parseInt(reset, 10) * 1000;
  
  if (response.status === 429 || rateLimitRemaining <= RATE_LIMIT_BUFFER) {
    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.max(0, rateLimitReset - Date.now());
    const jitter = Math.random() * 1000;
    console.log(`[smugmug-download] Rate limited, waiting ${waitTime + jitter}ms`);
    await new Promise(r => setTimeout(r, waitTime + jitter));
  }
}

async function checkOriginalExists(slug: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: `originals/${slug}.jpg`,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function downloadOriginal(
  smugmugKey: string,
  slug: string,
  env: Env
): Promise<{ success: boolean; originalStored?: boolean; error?: string }> {
  console.log(`[smugmug-download] Processing ${slug} (${smugmugKey})`);
  
  // Idempotency check - skip if already downloaded
  const exists = await checkOriginalExists(slug);
  if (exists) {
    console.log(`[smugmug-download] Original already exists for ${slug}`);
    
    // Update Neon anyway
    const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
    await sql`
      UPDATE photos SET original_stored = true, updated_at = now()
      WHERE slug = ${slug}
    `;
    
    return { success: true, originalStored: true };
  }
  
  try {
    // Get image URI from SmugMug
    const metaUrl = `https://api.smugmug.com/api/v2/image/${smugmugKey}`;
    const auth = createOAuthHeader(metaUrl);
    
    const metaResp = await fetch(metaUrl, {
      headers: { 'Authorization': auth, 'Accept': 'application/json' }
    });
    
    await waitForRateLimit(metaResp);
    
    if (!metaResp.ok) {
      return { success: false, error: `Meta API error: ${metaResp.status}` };
    }
    
    const meta = await metaResp.json();
    const imageUri = meta.Response?.Image?.Uri || meta.Response?.Image?.ArchivedUri;
    
    if (!imageUri) {
      return { success: false, error: 'No image URI found' };
    }
    
    // Download original
    console.log(`[smugmug-download] Downloading from ${imageUri}`);
    const imgResp = await fetch(imageUri);
    
    if (!imgResp.ok) {
      return { success: false, error: `Download error: ${imgResp.status}` };
    }
    
    const arrayBuffer = await imgResp.arrayBuffer();
    const original = Buffer.from(arrayBuffer);
    
    console.log(`[smugmug-download] Downloaded ${original.length} bytes`);
    
    // Upload to R2 (private)
    const key = `originals/${slug}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: original,
      ContentType: 'image/jpeg',
    }));
    
    console.log(`[smugmug-download] Uploaded to R2: ${key}`);
    
    // Update Neon
    const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
    await sql`
      UPDATE photos SET 
        original_r2_key = ${key},
        original_stored = true,
        updated_at = now()
      WHERE slug = ${slug}
    `;
    
    return { success: true, originalStored: true };
    
  } catch (error: any) {
    console.error(`[smugmug-download] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function handleSmugMugDownload(
  body: { smugmugKey: string; slug: string },
  env: Env
): Promise<{ success: boolean; originalStored?: boolean; error?: string }> {
  return downloadOriginal(body.smugmugKey, body.slug, env);
}
