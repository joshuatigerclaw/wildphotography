#!/usr/bin/env node
/**
 * Reindex eligible photos into Typesense
 * Run: node scripts/reindex-search-ready.js
 *
 * Indexes photos where:
 * - ready_for_public_render = true
 * - derivatives_complete = true
 * - is_active = true (not deleted)
 *
 * NOTE: Does NOT require search_ready=true because 44K+ photos have all
 * required flags set but search_ready=false (import pipeline backlog).
 *
 * small_url is included in indexed fields.
 */

const { neon } = require('@neondatabase/serverless');
const { Client } = require('typesense');

const NEON_DB_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY || 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const COLLECTION = 'photos';

const sql = neon(NEON_DB_URL);
const typesense = new Client({
  nodes: [{ host: TYPESENSE_HOST, port: 443, protocol: 'https' }],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 30,
});

/** Transform Neon photo to Typesense document */
function transformPhoto(photo) {
  return {
    id: String(photo.id),
    slug: photo.slug || '',
    title: photo.title || '',
    description: photo.description || '',
    thumb_url: photo.thumb_url || '',
    small_url: photo.small_url || '',
    medium_url: photo.medium_url || '',
    large_url: photo.large_url || '',
    keywords: photo.keywords || '',
    gallery_slug: photo.gallery_slug || '',
    gallery_id: photo.gallery_id || 0,
    location_name: photo.location_name || '',
    country: photo.country || '',
    region: photo.region || '',
    search_ready: true,
    species_common_name: photo.species_common_name || '',
    animal_group: photo.animal_group || '',
    photographer: photo.photographer || '',
    lat: (typeof photo.lat === 'number' && !isNaN(photo.lat)) ? photo.lat : 0,
    lon: (typeof photo.lon === 'number' && !isNaN(photo.lon)) ? photo.lon : 0,
    date_taken: (typeof photo.date_taken === 'number' && !isNaN(photo.date_taken)) ? photo.date_taken : 0,
    popularity: (typeof photo.popularity === 'number' && !isNaN(photo.popularity)) ? photo.popularity : 0,
  };
}

async function fetchSearchReadyPhotos() {
  console.log('Fetching eligible photos from Neon...');
  const photos = await sql`
    SELECT 
      p.id, p.slug, p.title, p.description,
      p.thumb_url, p.small_url, p.medium_url, p.large_url,
      p.keywords, p.gallery_slug, p.gallery_id,
      p.location_name, p.country, p.region,
      p.species_common_name, p.animal_group, p.photographer,
      p.lat, p.lon, p.date_taken, p.popularity
    FROM photos p
    WHERE p.ready_for_public_render = true
      AND p.derivatives_complete = true
      AND p.is_active = true
    ORDER BY p.id
    LIMIT 50000
  `;
  console.log(`Found ${photos.length} eligible photos to index`);
  return photos;
}

async function indexPhotos() {
  const photos = await fetchSearchReadyPhotos();
  if (!photos.length) {
    console.log('No photos to index');
    return;
  }

  const documents = photos.map(transformPhoto);
  console.log(`Indexing ${documents.length} documents...`);

  // Index in batches of 200
  const batchSize = 200;
  let indexed = 0;
  let errors = 0;
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    try {
      const result = await typesense
        .collections(COLLECTION)
        .documents()
        .import(batch, { action: 'upsert' });
      
      const succeeded = result.filter(r => r.success).length;
      const failed = result.filter(r => !r.success).length;
      indexed += succeeded;
      errors += failed;
      
      if (failed > 0) {
        const failedItems = result.filter(r => !r.success).slice(0, 3);
        console.log(`  Batch ${Math.floor(i/batchSize)+1}: ${succeeded} ok, ${failed} errors`);
        failedItems.forEach(f => console.log(`    ERROR id=${f.document?.id || '?'}: ${f.error}`));
      } else {
        console.log(`  Batch ${Math.floor(i/batchSize)+1}: ${succeeded} indexed`);
      }
    } catch (e) {
      console.error(`  Batch ${Math.floor(i/batchSize)+1} failed:`, e.message);
      errors += batch.length;
    }
  }

  console.log(`\nIndexing complete: ${indexed} succeeded, ${errors} errors`);
  return { indexed, errors };
}

async function verifyIndexing() {
  try {
    const result = await typesense.collections(COLLECTION).retrieve();
    console.log(`\nTypesense collection '${COLLECTION}': ${result.num_documents} documents`);
    
    // Check small_url is indexed
    const schema = result.fields;
    const hasSmall = schema.some(f => f.name === 'small_url');
    console.log(`small_url field in schema: ${hasSmall ? 'YES' : 'NO'}`);
    
    return result;
  } catch (e) {
    console.error('Verification error:', e.message);
    throw e;
  }
}

async function main() {
  console.log('=== Reindex eligible photos to Typesense ===\n');
  
  try {
    await indexPhotos();
    await verifyIndexing();
    console.log('\n✅ Reindex complete!');
  } catch (e) {
    console.error('\n❌ Reindex failed:', e.message);
    process.exit(1);
  }
}

main();
