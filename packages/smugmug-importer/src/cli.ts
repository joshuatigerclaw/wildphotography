/**
 * SmugMug CLI - Fixed OAuth Implementation
 * 
 * Usage:
 *   npx ts-node src/cli.ts --album <album-key>
 *   npx ts-node src/cli.ts --album <album-key> --dry-run
 */

import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';

// Configuration - set via environment or use defaults
const API_KEY = process.env.SMUGMUG_API_KEY || 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const API_SECRET = process.env.SMUGMUG_API_SECRET || 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp';
const ACCESS_TOKEN = process.env.SMUGMUG_ACCESS_TOKEN || '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8';
const ACCESS_TOKEN_SECRET = process.env.SMUGMUG_ACCESS_TOKEN_SECRET || 'V5Ggv3kvtffLpxqBjXP5HMQgrZHPfRfFP8c2sfdkTmdkrBD4Qx5ZZLgPQJzHR4LP';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const sql = neon(DATABASE_URL);

// OAuth setup
const oauth = new OAuth({
  consumer: { key: API_KEY, secret: API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

// Axios client
const client = axios.create({
  baseURL: 'https://api.smugmug.com/api/v2',
  headers: { 'Accept': 'application/json' },
});

// Add OAuth interceptor
client.interceptors.request.use((config) => {
  const baseUrl = config.baseURL || '';
  const url = baseUrl + (config.url || '');
  const auth = oauth.toHeader(
    oauth.authorize({ url, method: (config.method || 'GET').toUpperCase() }, { key: ACCESS_TOKEN, secret: ACCESS_TOKEN_SECRET })
  );
  config.headers['Authorization'] = auth['Authorization'];
  return config;
});

function makeSlug(str: string): string {
  return (str || 'untitled').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

async function importAlbum(albumKey: string, dryRun: boolean = false) {
  console.log(`\n=== Importing album: ${albumKey} ===\n`);
  
  // Get album info
  console.log('[import] Fetching album info...');
  const albumRes = await client.get(`/album/${albumKey}`);
  const album = albumRes.data.Response.Album;
  console.log(`[import] Album: ${album.Name} (${album.ImageCount} images)`);
  
  if (dryRun) {
    console.log('[import] Dry run - would import', album.ImageCount, 'photos');
    return;
  }
  
  // Upsert gallery
  const slug = makeSlug(album.Name);
  console.log('[import] Gallery slug:', slug);
  
  const [existing] = await sql('SELECT id FROM galleries WHERE slug = $1', [slug]);
  let galleryId: number;
  
  if (existing) {
    await sql('UPDATE galleries SET name = $1, description = $2, date_modified = NOW() WHERE id = $3', 
      [album.Name, album.Description || null, existing.id]);
    galleryId = existing.id;
    console.log('[import] Updated gallery:', galleryId);
  } else {
    const [result] = await sql(
      'INSERT INTO galleries (name, slug, description, is_active, date_created) VALUES ($1, $2, $3, true, NOW()) RETURNING id',
      [album.Name, slug, album.Description || null]
    );
    galleryId = result.id;
    console.log('[import] Created gallery:', galleryId);
  }
  
  // Get images
  console.log('[import] Fetching images...');
  const imagesRes = await client.get(`/album/${albumKey}!images?count=100`);
  const images = imagesRes.data.Response.AlbumImage || [];
  console.log('[import] Found', images.length, 'images');
  
  let imported = 0;
  for (const img of images) {
    try {
      const title = img.Caption || img.FileName || 'Untitled';
      const pslug = makeSlug(title) + '-' + img.ImageKey.substring(0, 6);
      
      // Upsert photo
      const [existingPhoto] = await sql('SELECT id FROM photos WHERE smugmug_key = $1', [img.ImageKey]);
      
      if (existingPhoto) {
        await sql(
          'UPDATE photos SET title = $1, slug = $2, description = $3, width = $4, height = $5, date_modified = NOW() WHERE id = $6',
          [title, pslug, img.Description || null, img.Width || null, img.Height || null, existingPhoto.id]
        );
      } else {
        const [result] = await sql(
          'INSERT INTO photos (smugmug_key, slug, title, description, width, height, date_uploaded, date_modified, is_active, popularity) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), true, 0) RETURNING id',
          [img.ImageKey, pslug, title, img.Description || null, img.Width || null, img.Height || null]
        );
        
        // Link to gallery
        await sql(
          'INSERT INTO gallery_photos (gallery_id, photo_id, sort_order, date_added) VALUES ($1, $2, 0, NOW()) ON CONFLICT DO NOTHING',
          [galleryId, result.id]
        );
      }
      
      // Handle keywords
      const keywords = img.Keywords || [];
      const kwList = Array.isArray(keywords) ? keywords : [];
      
      for (const kw of kwList) {
        const kslug = makeSlug(kw);
        if (!kslug) continue;
        
        await sql('INSERT INTO keywords (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING', [kw.toLowerCase().trim(), kslug]);
        const [keyword] = await sql('SELECT id FROM keywords WHERE slug = $1', [kslug]);
        
        // Get the photo ID
        const [photo] = await sql('SELECT id FROM photos WHERE smugmug_key = $1', [img.ImageKey]);
        
        if (keyword && photo) {
          await sql('INSERT INTO photo_keywords (photo_id, keyword_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [photo.id, keyword.id]);
        }
      }
      
      imported++;
      if (imported % 10 === 0) console.log('[import] Progress:', imported);
    } catch (e: any) {
      console.error('[import] Error:', e.message);
    }
  }
  
  console.log(`\n=== Import complete: ${imported} photos ===\n`);
}

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
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node src/cli.ts --album wNBfp9');
    console.log('  npx ts-node src/cli.ts --album ZXn2L5 --dry-run');
    process.exit(1);
  }
  
  try {
    await importAlbum(options.album, options.dryRun);
    console.log('✅ Import complete!');
  } catch (error: any) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

main();
