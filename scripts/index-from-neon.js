#!/usr/bin/env node

/**
 * Index photos from Neon into Typesense
 * 
 * Usage: node scripts/index-from-neon.js
 */

const { neon } = require('@neondatabase/serverless');
const { Client } = require('typesense');

// Configuration
const NEON_DB_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY || 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const COLLECTION = 'photos';

// Initialize clients
const sql = neon(NEON_DB_URL);
const typesense = new Client({
  nodes: [{
    host: TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 30,
});

/**
 * Transform Neon photo to Typesense document
 */
function transformPhoto(photo) {
  const doc = {
    // Core identification
    id: String(photo.id),
    slug: photo.slug,
    title: photo.title,
    description: photo.description,
    
    // Image URLs (derivatives only - NEVER original)
    thumb_url: photo.thumb_url,
    small_url: photo.small_url,
    medium_url: photo.medium_url,
    large_url: photo.large_url,
    
    // Keywords
    keywords: photo.keywords ? photo.keywords.split(',').map(k => k.trim()) : [],
    
    // Gallery
    gallery: photo.gallery,
    gallery_slug: photo.gallery_slug,
    
    // Location
    location: photo.location,
    country: photo.location && photo.location.includes('Costa Rica') ? 'Costa Rica' : null,
    
    // Camera/lens
    camera_model: photo.camera_model,
    lens: photo.lens,
    
    // Dimensions
    width: photo.width,
    height: photo.height,
    orientation: photo.width && photo.height 
      ? (photo.width > photo.height ? 'landscape' : photo.width < photo.height ? 'portrait' : 'square')
      : null,
    
    // Timestamps for sorting
    taken_timestamp: photo.date_taken ? new Date(photo.date_taken).getTime() : null,
    taken_year: photo.date_taken ? new Date(photo.date_taken).getFullYear() : null,
    taken_month: photo.date_taken ? new Date(photo.date_taken).getMonth() + 1 : null,
    date_uploaded: photo.date_uploaded ? new Date(photo.date_uploaded).getTime() : Date.now(),
    
    // Popularity
    popularity: photo.popularity || 0,
    
    // Status
    status: 'active',
    
    // Price (placeholder)
    price_download: 29,
  };
  
  return doc;
}

/**
 * Fetch all photos from Neon with related data
 */
async function fetchPhotosFromNeon() {
  console.log('Fetching photos from Neon...');
  
  const photos = await sql(`
    SELECT 
      p.id, p.slug, p.title, p.description,
      p.thumb_url, p.small_url, p.medium_url, p.large_url,
      p.location, p.camera_model, p.lens, p.width, p.height,
      p.date_taken, p.date_uploaded, p.popularity,
      string_agg(DISTINCT k.name, ',') as keywords,
      string_agg(DISTINCT g.slug, ',') as gallery_slugs,
      string_agg(DISTINCT g.name, ',') as galleries
    FROM photos p
    LEFT JOIN photo_keywords pk ON p.id = pk.photo_id
    LEFT JOIN keywords k ON pk.keyword_id = k.id
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    WHERE p.is_active = true
    GROUP BY p.id
    ORDER BY p.popularity DESC, p.date_uploaded DESC
  `);
  
  console.log(`Found ${photos.length} photos in Neon`);
  return photos;
}

/**
 * Index photos into Typesense
 */
async function indexPhotos() {
  // Fetch photos from Neon
  const neonPhotos = await fetchPhotosFromNeon();
  
  if (neonPhotos.length === 0) {
    console.log('No photos to index');
    return;
  }
  
  // Transform to Typesense documents
  const documents = neonPhotos.map(transformPhoto);
  
  console.log(`Indexing ${documents.length} documents into Typesense...`);
  
  try {
    // Bulk import with upsert behavior
    const result = await typesense
      .collections(COLLECTION)
      .documents()
      .import(documents, { action: 'emplace' });
    
    // Check results
    const successCount = result.filter((r) => r.success).length;
    const errorCount = result.filter((r) => !r.success).length;
    
    console.log(`\nIndexing complete:`);
    console.log(`  - Success: ${successCount}`);
    console.log(`  - Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      const errors = result.filter((r) => !r.success);
      console.log(`\nErrors:`, JSON.stringify(errors.slice(0, 5), null, 2));
    }
    
    return { success: successCount, errors: errorCount };
  } catch (error) {
    console.error('Indexing error:', error);
    throw error;
  }
}

/**
 * Verify indexing
 */
async function verifyIndexing() {
  console.log('\nVerifying Typesense collection...');
  
  try {
    const result = await typesense.collections(COLLECTION).retrieve();
    console.log(`Collection '${COLLECTION}': ${result.num_documents} documents`);
    return result;
  } catch (error) {
    console.error('Verification error:', error);
    throw error;
  }
}

// Run
async function main() {
  console.log('=== Photo Indexing from Neon to Typesense ===\n');
  
  try {
    await indexPhotos();
    await verifyIndexing();
    console.log('\n✅ Indexing complete!');
  } catch (error) {
    console.error('\n❌ Indexing failed:', error);
    process.exit(1);
  }
}

main();
