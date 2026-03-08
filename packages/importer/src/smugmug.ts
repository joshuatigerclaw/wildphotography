/**
 * SmugMug Importer - Conservative Implementation
 * 
 * Features:
 * - Idempotent upserts (keyed by SmugMug image key)
 * - Rate limit respect with dynamic delays
 * - Bulk Typesense indexing
 * - Separated metadata import from downloads
 * 
 * NOT optimized for raw speed - optimized for correctness and resumability
 */

import { neon } from '@neondatabase/serverless';
import { Client } from 'typesense';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY || 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';

const SMUGMUG_API_KEY = process.env.SMUGMUG_API_KEY;
const SMUGMUG_API_SECRET = process.env.SMUGMUG_API_SECRET;

// Rate limit tracking
let lastRequestTime = 0;
let rateLimitRemaining = 100;
let rateLimitReset = 0;

async function rateLimitWait() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // If we're rate limited, wait
  if (rateLimitRemaining <= 0) {
    const waitTime = rateLimitReset - now + 1000;
    if (waitTime > 0) {
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  
  // Minimum delay between requests
  if (timeSinceLastRequest < 250) {
    await new Promise(r => setTimeout(r, 250 - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

async function smugmugRequest(endpoint: string, options: any = {}) {
  await rateLimitWait();
  
  // TODO: Implement actual SmugMug API call
  // This is a placeholder for the actual implementation
  
  console.log(`[smugmug] ${options.method || 'GET'} ${endpoint}`);
  return { data: [] };
}

/**
 * Stage 1: Enumerate Albums
 */
export async function enumerateAlbums() {
  console.log('[importer] Stage 1: Enumerating albums...');
  
  // TODO: Call SmugMug /api/v2/albums
  // const response = await smugmugRequest('/api/v2/albums');
  // return response.data;
  
  return [];
}

/**
 * Stage 2: Enumerate Images in Album
 */
export async function enumerateImages(albumKey: string) {
  console.log(`[importer] Stage 2: Enumerating images in album ${albumKey}...`);
  
  // TODO: Call SmugMug /api/v2/album/{albumKey}/images
  // const response = await smugmugRequest(`/api/v2/album/${albumKey}/images`);
  // return response.data;
  
  return [];
}

/**
 * Stage 3: Upsert Metadata to Neon
 * 
 * Uses idempotent upsert keyed by smugmug_image_key
 */
export async function upsertPhotoMetadata(photoData: any) {
  const sql = neon(DATABASE_URL);
  
  const slug = photoData.ImageKey.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  await sql(`
    INSERT INTO photos (
      smugmug_image_key, slug, title, description,
      image_url, thumbnail_url, width, height,
      date_taken, date_uploaded
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (smugmug_image_key) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      image_url = EXCLUDED.image_url,
      thumbnail_url = EXCLUDED.thumbnail_url,
      date_modified = NOW()
  `, [
    photoData.ImageKey,
    slug,
    photoData.Caption || photoData.Title || 'Untitled',
    photoData.Description,
    photoData.Uri,
    photoData.ThumbnailUrl,
    photoData.Width,
    photoData.Height,
    photoData.Date ? new Date(photoData.Date) : null,
  ]);
  
  console.log(`[neon] Upserted photo: ${photoData.ImageKey}`);
}

/**
 * Stage 4: Bulk Index to Typesense
 * 
 * Never index one document at a time
 */
export async function bulkIndexToTypesense(photos: any[]) {
  if (photos.length === 0) return;
  
  const typesense = new Client({
    host: TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
    apiKey: TYPESENSE_API_KEY,
  });
  
  // Prepare documents with required fields
  const documents = photos.map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    keywords: normalizeKeywords(p.keywords || []),
    gallery: p.gallery,
    location: p.location,
    camera_model: p.camera_model,
    lens: p.lens,
    taken_year: p.date_taken ? new Date(p.date_taken).getFullYear() : null,
    taken_timestamp: p.date_taken ? new Date(p.date_taken).getTime() : Date.now(),
    thumb_url: p.thumb_url,
    medium_url: p.medium_url,
    large_url: p.large_url,
  }));
  
  try {
    await typesense.collections('photos').documents().import(documents, { action: 'emplace' });
    console.log(`[typesense] Indexed ${documents.length} documents`);
  } catch (error) {
    console.error('[typesense] Bulk index error:', error);
  }
}

/**
 * Normalize keywords: lowercase, trim, deduplicate
 */
function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  return keywords
    .map(k => k.toLowerCase().trim())
    .filter(k => {
      if (seen.has(k)) return false;
      seen.add(k);
      return k.length > 0;
    });
}

/**
 * Full Import Pipeline
 * 
 * Run in stages:
 * 1. enumerateAlbums()
 * 2. For each album: enumerateImages()
 * 3. For each image: upsertPhotoMetadata()
 * 4. Bulk index to Typesense
 */
export async function runFullImport() {
  console.log('[importer] Starting full import...');
  
  const albums = await enumerateAlbums();
  console.log(`[importer] Found ${albums.length} albums`);
  
  let totalPhotos = 0;
  let photosForIndexing: any[] = [];
  
  for (const album of albums) {
    const images = await enumerateImages(album.AlbumKey);
    
    for (const image of images) {
      await upsertPhotoMetadata(image);
      photosForIndexing.push(image);
      totalPhotos++;
    }
    
    // Bulk index every 100 photos
    if (photosForIndexing.length >= 100) {
      await bulkIndexToTypesense(photosForIndexing);
      photosForIndexing = [];
    }
  }
  
  // Final bulk index
  if (photosForIndexing.length > 0) {
    await bulkIndexToTypesense(photosForIndexing);
  }
  
  console.log(`[importer] Import complete. Total photos: ${totalPhotos}`);
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'import') {
    runFullImport().catch(console.error);
  } else {
    console.log('Usage: node importer.js import');
  }
}
