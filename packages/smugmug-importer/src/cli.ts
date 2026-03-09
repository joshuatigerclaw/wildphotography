/**
 * SmugMug Importer CLI
 * 
 * Usage:
 *   npm run import -- --album <album-key>
 *   npm run import -- --album F3dK9M  (small test)
 *   npm run import -- --dry-run    (test without importing)
 */

import { SmugMugClient, Album, SmugMugImage } from './client';
import { transformToNeon, transformKeywords, transformToTypesense } from './transform';
import { neon } from '@neondatabase/serverless';

// Configuration
const SMUGMUG_CONFIG = {
  apiKey: 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB',
  apiSecret: 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp',
  accessToken: '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8',
  accessTokenSecret: 'V5Ggv3kvtffLpxqBjXP5HMQgrZHPfRfFP8c2sfdkTmdkrBD4Qx5ZZLgPQJzHR4LP',
};

const NEON_DB_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const sql = neon(NEON_DB_URL);

/**
 * Upsert gallery/album in Neon
 */
async function upsertGallery(albumKey: string, album: Album): Promise<number> {
  console.log(`[import] Upserting gallery: ${album.Name} (${albumKey})`);
  
  // Generate slug from album name
  const slug = album.Name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const [existing] = await sql(
    'SELECT id FROM galleries WHERE slug = $1',
    [slug]
  );
  
  if (existing) {
    await sql(`
      UPDATE galleries SET
        name = $1,
        description = $2,
        date_modified = NOW()
      WHERE id = $3
    `, [album.Name, album.Description || null, existing.id]);
    console.log(`[import] Updated gallery: ${slug} (id: ${existing.id})`);
    return existing.id;
  }
  
  const [result] = await sql(`
    INSERT INTO galleries (name, slug, description, cover_photo_id, is_active, date_created)
    VALUES ($1, $2, $3, NULL, true, NOW())
    RETURNING id
  `, [album.Name, slug, album.Description || null]);
  
  console.log(`[import] Created gallery: ${slug} (id: ${result.id})`);
  return result.id;
}

/**
 * Upsert photo in Neon
 */
async function upsertPhoto(
  galleryId: number,
  image: SmugMugImage,
  albumKey: string,
  albumName: string
): Promise<number> {
  const photoData = transformToNeon(image, albumKey, albumName);
  
  // Check if exists by smugmug_key
  const [existing] = await sql(
    'SELECT id FROM photos WHERE smugmug_key = $1',
    [image.ImageKey]
  );
  
  if (existing) {
    await sql(`
      UPDATE photos SET
        title = $1,
        description = $2,
        location = $3,
        camera_model = $4,
        lens = $5,
        width = $6,
        height = $7,
        orientation = $8,
        date_taken = $9,
        date_modified = NOW()
      WHERE id = $10
    `, [
      photoData.title,
      photoData.description,
      photoData.location,
      photoData.camera_model,
      photoData.lens,
      photoData.width,
      photoData.height,
      photoData.orientation,
      photoData.date_taken,
      existing.id
    ]);
    console.log(`[import] Updated photo: ${photoData.title} (id: ${existing.id})`);
    return existing.id;
  }
  
  const [result] = await sql(`
    INSERT INTO photos (
      smugmug_key, title, description, location,
      camera_model, lens, width, height, orientation,
      date_taken, date_uploaded, date_modified,
      is_active, popularity, original_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, 0, $13)
    RETURNING id
  `, [
    photoData.smugmug_key,
    photoData.title,
    photoData.description,
    photoData.location,
    photoData.camera_model,
    photoData.lens,
    photoData.width,
    photoData.height,
    photoData.orientation,
    photoData.date_taken,
    photoData.date_uploaded,
    photoData.date_modified,
    photoData.original_url,
  ]);
  
  // Link to gallery
  await sql(`
    INSERT INTO gallery_photos (gallery_id, photo_id, sort_order, date_added)
    VALUES ($1, $2, 0, NOW())
    ON CONFLICT DO NOTHING
  `, [galleryId, result.id]);
  
  console.log(`[import] Created photo: ${photoData.title} (id: ${result.id})`);
  return result.id;
}

/**
 * Upsert keywords
 */
async function upsertKeywords(photoId: number, keywords: string[]) {
  const normalized = keywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 0);
  
  for (const keyword of normalized) {
    const slug = keyword.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Insert keyword if not exists
    await sql(`
      INSERT INTO keywords (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO NOTHING
    `, [keyword, slug]);
    
    // Get keyword id
    const [kw] = await sql('SELECT id FROM keywords WHERE slug = $1', [slug]);
    
    // Link to photo
    await sql(`
      INSERT INTO photo_keywords (photo_id, keyword_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [photoId, kw.id]);
  }
}

/**
 * Import album
 */
async function importAlbum(albumKey: string, dryRun: boolean = false) {
  console.log(`\n=== Starting import for album: ${albumKey} ===\n`);
  
  const client = new SmugMugClient(SMUGMUG_CONFIG);
  
  // Get album info
  console.log('[import] Fetching album info...');
  const album = await client.getAlbum(albumKey);
  console.log(`[import] Album: ${album.Name} (${album.ImageCount} images)`);
  
  if (dryRun) {
    console.log('[import] Dry run - would create gallery and import photos');
    return;
  }
  
  // Upsert gallery
  const galleryId = await upsertGallery(albumKey, album);
  
  // Get images
  console.log(`[import] Fetching images from album...`);
  let page = 1;
  let totalImported = 0;
  const pageSize = 50;
  
  while (true) {
    const result = await client.getAlbumImages(albumKey, { start: (page - 1) * pageSize, count: pageSize });
    
    console.log(`[import] Page ${page}: ${result.images.length} images`);
    
    for (const image of result.images) {
      try {
        // Get keywords
        const keywords = image.Keywords || [];
        
        // Upsert photo
        const photoId = await upsertPhoto(galleryId, image, albumKey, album.Name);
        
        // Upsert keywords
        await upsertKeywords(photoId, keywords);
        
        totalImported++;
      } catch (error) {
        console.error(`[import] Error importing image ${image.ImageKey}:`, error);
      }
    }
    
    if ((page * pageSize) >= result.total) {
      break;
    }
    
    page++;
    
    // Rate limit check
    const rateLimit = client.getRateLimitStatus();
    console.log(`[import] Rate limit: ${rateLimit.remaining} remaining`);
  }
  
  console.log(`\n=== Import complete: ${totalImported} photos ===\n`);
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const options: { album?: string; dryRun: boolean } = { dryRun: false };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--album' && args[i + 1]) {
      options.album = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }
  
  if (!options.album) {
    console.log('Usage: npx ts-node src/cli.ts --album <album-key> [--dry-run]');
    console.log('');
    console.log('Options:');
    console.log('  --album <key>   SmugMug album key to import');
    console.log('  --dry-run        Test without importing');
    process.exit(1);
  }
  
  try {
    await importAlbum(options.album, options.dryRun);
    console.log('✅ Import complete!');
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

main();
