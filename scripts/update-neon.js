/**
 * Update Neon with processed image metadata
 * 
 * Usage: node scripts/update-neon.js <photo-id> <derivative-keys-json>
 * 
 * Or use the helper function in code:
 *   import { updatePhotoDerivatives } from './update-neon';
 */

const { neon } = require('@neondatabase/serverless');

const NEON_DB_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

/**
 * Update photo with derivative metadata
 */
async function updatePhotoDerivatives(photoId, metadata) {
  const sql = neon(NEON_DB_URL);
  
  const { 
    original_r2_key,
    thumb_r2_key,
    small_r2_key,
    medium_r2_key,
    large_r2_key,
    preview_r2_key,
    width,
    height,
    orientation
  } = metadata;
  
  // Generate derivative URLs from R2 keys
  const mediaBase = 'https://wildphotography-media.josh-ec6.workers.dev';
  
  // Build URL from key (replace prefix with base URL)
  const keyToUrl = (key) => key ? `${mediaBase}/${key}` : null;
  
  const updateQuery = `
    UPDATE photos SET
      original_r2_key = $1,
      thumb_url = $2,
      small_url = $3,
      medium_url = $4,
      large_url = $5,
      preview_url = $6,
      width = $7,
      height = $8,
      orientation = $9,
      date_modified = NOW()
    WHERE id = $10
    RETURNING id, slug, title
  `;
  
  const result = await sql(updateQuery, [
    original_r2_key,
    keyToUrl(thumb_r2_key),
    keyToUrl(small_r2_key),
    keyToUrl(medium_r2_key),
    keyToUrl(large_r2_key),
    keyToUrl(preview_r2_key),
    width,
    height,
    orientation,
    photoId
  ]);
  
  return result[0];
}

/**
 * CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/update-neon.js <photo-id> <metadata-json>');
    console.log('Or pass individual values:');
    console.log('  node scripts/update-neon.js 16 original.jpg thumb.jpg small.jpg medium.jpg large.jpg preview.jpg 400 600 landscape');
    process.exit(1);
  }
  
  let metadata;
  
  if (args[1].startsWith('{')) {
    // JSON input
    metadata = JSON.parse(args[1]);
  } else {
    // Individual values
    metadata = {
      original_r2_key: args[1],
      thumb_r2_key: args[2],
      small_r2_key: args[3],
      medium_r2_key: args[4],
      large_r2_key: args[5],
      preview_r2_key: args[6],
      width: parseInt(args[7]),
      height: parseInt(args[8]),
      orientation: args[9]
    };
  }
  
  const photoId = args[0];
  
  console.log(`Updating photo ${photoId} with derivative metadata...`);
  
  try {
    const result = await updatePhotoDerivatives(photoId, metadata);
    console.log('✅ Updated successfully!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updatePhotoDerivatives };
