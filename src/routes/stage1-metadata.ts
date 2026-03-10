/**
 * SmugMug Import Pipeline - Stage 1: Metadata Crawl
 * 
 * Fetches metadata from SmugMug albums and photos
 * Handles rate limiting and paging
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import type { Env } from '../types';

const SMUGMUG_API_KEY = '6hJGBgm49JsxZhWnBm3vMFcKnH5tbSd9';
const SMUGMUG_API_SECRET = 'MMD4PRS7x52DSW44jjQHNv9FfqN22RwJf8p8XHWFnjcSkkMwGxHGmcw4DwTcHChs';
const ACCESS_TOKEN = '244ntqLqM8gZ38MKrbM67QPdgsws2T7x';
const ACCESS_SECRET = '3BdZpBsttNX5rsw94H6Q38CxB4t4NS9pfJDdzJ5GXXxp5F6MN4bcBdjHcfrB67rZ';

// Rate limit state
let rateLimitRemaining = 100;
let rateLimitReset = Date.now() + 60000;
const RATE_LIMIT_BUFFER = 5; // Stop when 5 requests remaining

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
  // Check rate limit headers
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  const retryAfter = response.headers.get('Retry-After');
  
  if (remaining) rateLimitRemaining = parseInt(remaining, 10);
  if (reset) rateLimitReset = parseInt(reset, 10) * 1000;
  
  // If 429 or low on requests, wait
  if (response.status === 429 || rateLimitRemaining <= RATE_LIMIT_BUFFER) {
    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.max(0, rateLimitReset - Date.now());
    const jitter = Math.random() * 1000; // Add 0-1s jitter
    console.log(`[smugmug-metadata] Rate limited, waiting ${waitTime + jitter}ms`);
    await new Promise(r => setTimeout(r, waitTime + jitter));
  }
}

export interface SmugMugImage {
  ImageKey: string;
  FileName: string;
  Caption?: string;
  DateTimeOriginal?: string;
  OriginalWidth?: number;
  OriginalHeight?: number;
  CameraModel?: string;
  Uri?: string;
  ArchivedUri?: string;
  KeywordArray?: string[];
  UploadedDate?: string;
}

export interface SmugMugAlbum {
  AlbumKey: string;
  Name: string;
}

export async function crawlAlbumMetadata(
  albumKey: string,
  env: Env,
  page = 1,
  pageSize = 50
): Promise<{ images: SmugMugImage[]; nextPage: number | null; processed: number }> {
  const url = `https://api.smugmug.com/api/v2/album/${albumKey}!images?n=${pageSize}&start=${(page - 1) * pageSize + 1}`;
  const auth = createOAuthHeader(url);
  
  console.log(`[smugmug-metadata] Fetching page ${page} of album ${albumKey}`);
  
  const response = await fetch(url, {
    headers: { 'Authorization': auth, 'Accept': 'application/json' }
  });
  
  await waitForRateLimit(response);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SmugMug API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const images: SmugMugImage[] = data.Response?.AlbumImage || [];
  const nextPage = data.Response?.Pages?.NextPage ? page + 1 : null;
  
  return { images, nextPage, processed: images.length };
}

export async function storeImageMetadata(images: SmugMugImage[], env: Env): Promise<number> {
  const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
  
  let stored = 0;
  
  for (const img of images) {
    // Generate slug from filename
    const baseName = img.FileName?.replace(/\.[^.]+$/, '') || 'photo';
    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + img.ImageKey?.slice(0, 6);
    
    const keywords = img.KeywordArray?.join(', ') || '';
    
    try {
      await sql`
        INSERT INTO photos (slug, title, description_long, keywords, smugmug_key, date_taken, width, height, camera_model, uploaded_at, status, metadata_complete)
        VALUES (${slug}, ${img.FileName}, ${img.Caption || ''}, ${keywords}, ${img.ImageKey}, ${img.DateTimeOriginal}, ${img.OriginalWidth}, ${img.OriginalHeight}, ${img.CameraModel}, ${img.UploadedDate || new Date().toISOString()}, 'public', true)
        ON CONFLICT (slug) DO UPDATE SET
          title = ${img.FileName},
          description_long = ${img.Caption || ''},
          keywords = ${keywords},
          smugmug_key = ${img.ImageKey},
          date_taken = ${img.DateTimeOriginal},
          width = ${img.OriginalWidth},
          height = ${img.OriginalHeight},
          camera_model = ${img.CameraModel},
          metadata_complete = true,
          updated_at = now()
      `;
      stored++;
    } catch (e: any) {
      console.error(`[smugmug-metadata] Error storing ${img.ImageKey}:`, e.message);
    }
  }
  
  return stored;
}

export async function handleSmugMugMetadataCrawl(
  body: { albumKey?: string; photoKey?: string; page?: number },
  env: Env
): Promise<{ success: boolean; stored?: number; nextPage?: number; error?: string }> {
  try {
    const { albumKey, photoKey, page = 1 } = body;
    
    if (photoKey) {
      // Single photo metadata
      const url = `https://api.smugmug.com/api/v2/image/${photoKey}`;
      const auth = createOAuthHeader(url);
      
      const response = await fetch(url, {
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
      
      await waitForRateLimit(response);
      
      if (!response.ok) {
        return { success: false, error: `API error: ${response.status}` };
      }
      
      const data = await response.json();
      const image: SmugMugImage = data.Response?.Image;
      
      if (image) {
        const stored = await storeImageMetadata([image], env);
        return { success: true, stored };
      }
      
      return { success: false, error: 'Image not found' };
    }
    
    if (albumKey) {
      // Album metadata with paging
      const { images, nextPage, processed } = await crawlAlbumMetadata(albumKey, env, page);
      
      if (images.length > 0) {
        const stored = await storeImageMetadata(images, env);
        return { success: true, stored, nextPage: nextPage || undefined };
      }
      
      return { success: true, stored: 0 };
    }
    
    return { success: false, error: 'Missing albumKey or photoKey' };
    
  } catch (error: any) {
    console.error('[smugmug-metadata] Error:', error.message);
    return { success: false, error: error.message };
  }
}
