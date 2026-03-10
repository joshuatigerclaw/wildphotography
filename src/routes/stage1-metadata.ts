/**
 * SmugMug Import Pipeline - Stage 1: Metadata Crawl
 * 
 * Fetches metadata from SmugMug albums and photos
 * Handles rate limiting and paging
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import type { Env } from '../types';

// Using oauth-1.0a library
import OAuth from 'oauth-1.0a';
import querystring from 'querystring';

const SMUGMUG_API_KEY = 'mD9BzwdJchnMQQfGBNHDvmrWGSVQF6DM';
const SMUGMUG_API_SECRET = 'cTDWwNqHDMFnPmR7HkxRVZhVkb7jb2S4R2wzqPrfSQjH9LrTLxzX9Jv5SpLk8vjg';
const ACCESS_TOKEN = 'nrgfM49dPGnPCxGp6fKFmFXWvv3nJ7dG';
const ACCESS_SECRET = 'RvvscsGWBKFXNS9k2Phf9r38RJ2fMrnbn7WRDbWqLLnTLcvjRcPVXn9Bqpx24jR8';

// Rate limit state
let rateLimitRemaining = 100;
let rateLimitReset = Date.now() + 60000;
const RATE_LIMIT_BUFFER = 5;

// OAuth instance
const oauth = new OAuth({
  consumer: { key: SMUGMUG_API_KEY, secret: SMUGMUG_API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base, key) {
    return crypto.createHmac('sha1', key).update(base).digest('base64');
  }
});

const token = { key: ACCESS_TOKEN, secret: ACCESS_SECRET };

async function waitForRateLimit(response: Response): Promise<void> {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  const retryAfter = response.headers.get('Retry-After');
  
  if (remaining) rateLimitRemaining = parseInt(remaining, 10);
  if (reset) rateLimitReset = parseInt(reset, 10) * 1000;
  
  if (response.status === 429 || rateLimitRemaining <= RATE_LIMIT_BUFFER) {
    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.max(0, rateLimitReset - Date.now());
    const jitter = Math.random() * 1000;
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
  string;
  Uri ArchivedUri?: string;
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
  const url = `https://api.smugmug.com/api/v2/album/${albumKey}!images`;
  const params = { n: pageSize.toString(), start: ((page - 1) * pageSize + 1).toString() };
  
  console.log(`[smugmug-metadata] Fetching page ${page} of album ${albumKey}`);
  
  const request = { url, method: 'GET', data: params };
  const auth = oauth.toHeader(oauth.authorize(request, token));
  
  const response = await fetch(url + '?' + querystring.stringify(params), {
    headers: { ...auth, 'Accept': 'application/json' }
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
      const url = `https://api.smugmug.com/api/v2/image/${photoKey}`;
      const request = { url, method: 'GET' };
      const auth = oauth.toHeader(oauth.authorize(request, token));
      
      const response = await fetch(url, {
        headers: { ...auth, 'Accept': 'application/json' }
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
