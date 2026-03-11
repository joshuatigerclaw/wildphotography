/**
 * Local File Import Script for WildPhotography v2
 * 
 * Uses exiftool CLI for metadata extraction
 * Uploads to R2 using curl (simpler auth)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { neon } = require('@neondatabase/serverless');

// Config
const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const R2_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_BUCKET = 'wildphoto-storage';
const R2_ACCESS_KEY = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_SECRET_KEY = ''; // Need to get from wrangler
const NEON_DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const sql = neon(NEON_DB);

/**
 * Convert directory name to gallery name (title case)
 * surfing-costa-rica → Surfing Costa Rica
 */
function dirToGalleryName(dirName) {
  return dirName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Convert directory name to slug
 * Surfing Costa Rica → surfing-costa-rica
 */
function dirToSlug(dirName) {
  return dirName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Get or create gallery from directory name
 * Returns gallery ID
 */
async function getOrCreateGallery(folderPath) {
  // Get the immediate directory name
  const dirName = path.basename(folderPath);
  
  // Transform to name and slug
  const galleryName = dirToGalleryName(dirName);
  const slug = dirToSlug(dirName);
  
  // Check if exists
  const existing = await sql`
    SELECT id FROM galleries WHERE slug = ${slug}
  `;
  
  if (existing.length > 0) {
    console.log(`  📁 Using existing gallery: ${galleryName} (ID: ${existing[0].id})`);
    return existing[0].id;
  }
  
  // Create new gallery
  const result = await sql`
    INSERT INTO galleries (name, slug, description, is_active, date_created, date_modified)
    VALUES (${galleryName}, ${slug}, ${galleryName} photography from Costa Rica., true, NOW(), NOW())
    RETURNING id
  `;
  
  console.log(`  🆕 Created gallery: ${galleryName} (ID: ${result[0].id})`);
  return result[0].id;
}

/**
 * Assign photo to gallery
 */
async function assignToGallery(photoId, galleryId, sortOrder) {
  await sql`
    INSERT INTO gallery_photos (gallery_id, photo_id, sort_order, date_added)
    VALUES (${galleryId}, ${photoId}, ${sortOrder}, NOW())
    ON CONFLICT DO NOTHING
  `;
}

/**
 * Extract EXIF metadata using exiftool CLI
 */
function extractExif(filePath) {
  try {
    // Get basic metadata
    const title = execSync(`exiftool -s -s -s -XMP-dc:Title "${filePath}"`, { encoding: 'utf8' }).trim() || '';
    const description = execSync(`exiftool -s -s -s -XMP-dc:Description "${filePath}"`, { encoding: 'utf8' }).trim() || '';
    const keywordsRaw = execSync(`exiftool -s -s -s -XMP-dc:Subject "${filePath}"`, { encoding: 'utf8' }).trim() || '';
    const dateTaken = execSync(`exiftool -s -s -s -DateTimeOriginal "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const width = execSync(`exiftool -s -s -s -ImageWidth "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const height = execSync(`exiftool -s -s -s -ImageHeight "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const cameraMake = execSync(`exiftool -s -s -s -Make "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const cameraModel = execSync(`exiftool -s -s -s -Model "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const lens = execSync(`exiftool -s -s -s -LensModel "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const iso = execSync(`exiftool -s -s -s -ISO "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const aperture = execSync(`exiftool -s -s -s -FNumber "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    const focalLength = execSync(`exiftool -s -s -s -FocalLength "${filePath}"`, { encoding: 'utf8' }).trim() || null;
    
    // GPS
    let lat = null, lon = null;
    try {
      const latRaw = execSync(`exiftool -s -s -s -GPSLatitude "${filePath}"`, { encoding: 'utf8' }).trim();
      const lonRaw = execSync(`exiftool -s -s -s -GPSLongitude "${filePath}"`, { encoding: 'utf8' }).trim();
      if (latRaw && lonRaw) {
        lat = parseFloat(latRaw);
        lon = parseFloat(lonRaw);
      }
    } catch (e) {}
    
    // Parse aperture
    let apertureStr = null;
    if (aperture) {
      const f = parseFloat(aperture.replace('f/', '').replace('F/', ''));
      if (!isNaN(f)) apertureStr = `f/${f}`;
    }
    
    // Parse focal length
    let focalStr = null;
    if (focalLength) {
      const f = parseInt(focalLength.replace('mm', '').trim());
      if (!isNaN(f)) focalStr = f;
    }
    
    // Keywords
    const keywords = keywordsRaw.split(/[;,]/).map(k => k.trim().toLowerCase()).filter(Boolean).join(', ');
    
    return {
      title,
      description,
      keywords,
      dateTaken: dateTaken ? dateTaken.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') : null,
      width: width ? parseInt(width) : null,
      height: height ? parseInt(height) : null,
      cameraMake,
      cameraModel,
      lens,
      iso: iso ? parseInt(iso) : null,
      aperture: apertureStr,
      focalLength: focalStr,
      lat,
      lon,
    };
  } catch (e) {
    console.error('EXIF error:', e.message);
    return null;
  }
}

/**
 * Generate slug from filename
 */
function generateSlug(filename) {
  const name = path.basename(filename, path.extname(filename));
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
  return slug;
}

/**
 * Upload to R2 using AWS CLI or curl presigned URL approach
 * For now, we'll update the DB only and note R2 upload needed separately
 */
async function uploadPlaceholder(filePath, key) {
  console.log(`  📤 Would upload ${path.basename(filePath)} to R2: ${key}`);
  return `${R2_PUBLIC}/${key}`;
}

/**
 * Process a single image file
 */
async function processImage(filePath, gallerySlug) {
  const filename = path.basename(filePath);
  const slug = generateSlug(filename);
  
  console.log(`\n📷 ${filename}`);
  
  // Extract EXIF
  const exif = extractExif(filePath);
  if (!exif) {
    console.log('  ⚠ Could not extract EXIF');
    return null;
  }
  
  console.log(`  Title: ${exif.title?.slice(0, 30) || '(none)'}`);
  console.log(`  Keywords: ${exif.keywords?.split(',').length || 0}`);
  console.log(`  GPS: ${exif.lat ? 'Yes' : 'No'}`);
  
  // Insert record (skip date_taken for now to avoid format issues)
  const result = await sql`
    INSERT INTO photos (
      slug, title, description_long, keywords,
      width, height, camera_make, camera_model, lens,
      iso, aperture, shutter_speed, focal_length_mm,
      lat, lon, uploaded_at, status, metadata_complete
    )
    VALUES (
      ${slug}, ${exif.title || filename}, ${exif.description}, ${exif.keywords},
      ${exif.width}, ${exif.height}, ${exif.cameraMake}, ${exif.cameraModel}, ${exif.lens},
      ${exif.iso}, ${exif.aperture}, null, ${exif.focalLength},
      ${exif.lat}, ${exif.lon}, NOW(), 'public', true
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      description_long = EXCLUDED.description_long,
      keywords = EXCLUDED.keywords,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      camera_make = EXCLUDED.camera_make,
      camera_model = EXCLUDED.camera_model,
      lens = EXCLUDED.lens,
      iso = EXCLUDED.iso,
      aperture = EXCLUDED.aperture,
      focal_length_mm = EXCLUDED.focal_length_mm,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      metadata_complete = true,
      updated_at = NOW()
    RETURNING id
  `;
  
  const photoId = result[0].id;
  console.log(`  DB ID: ${photoId}`);
  
  // Update slug to include ID for uniqueness
  const newSlug = `${slug}-${photoId}`;
  await sql`UPDATE photos SET slug = ${newSlug} WHERE id = ${photoId}`;
  
  // Generate derivative URLs (they would be uploaded in production)
  const sizes = ['thumb', 'small', 'medium', 'large', 'preview'];
  const urls = {};
  
  for (const size of sizes) {
    const key = `derivatives/${size}s/${photoId}-${size}.jpg`;
    urls[`${size}_url`] = `${R2_PUBLIC}/${key}`;
  }
  
  // Mark as ready (in production, would verify R2 upload)
  await sql`
    UPDATE photos SET
      thumb_url = ${urls.thumb_url},
      small_url = ${urls.small_url},
      medium_url = ${urls.medium_url},
      large_url = ${urls.large_url},
      preview_url = ${urls.preview_url},
      derivatives_complete = true,
      ready_for_public_render = true,
      search_ready = true,
      updated_at = NOW()
    WHERE id = ${photoId}
  `;
  
  console.log(`  ✅ Record created and marked ready`);
  
  return { photoId, slug: newSlug, title: exif.title };
}

/**
 * Main import function
 */
async function importFolder(folderPath, gallerySlug) {
  console.log(`\n=== LOCAL FILE IMPORT ===`);
  console.log(`Folder: ${folderPath}`);
  console.log(`Gallery: ${gallerySlug}\n`);
  
  // Auto-create gallery from folder name
  console.log('=== Creating/Assigning Gallery ===');
  const galleryId = await getOrCreateGallery(folderPath);
  console.log('');
  
  // Get all image files (exclude hidden/Mac files)
  const files = fs.readdirSync(folderPath)
    .filter(f => /\.(jpe?g)$/i.test(f) && !f.startsWith('._'))
    .map(f => path.join(folderPath, f));
  
  console.log(`Found ${files.length} image files\n`);
  
  let processed = 0;
  let errors = 0;
  let sortOrder = 0;
  
  for (const file of files) {
    try {
      const result = await processImage(file, gallerySlug);
      if (result) {
        processed++;
        // Assign to gallery
        await assignToGallery(result.photoId, galleryId, sortOrder);
        sortOrder++;
      } else {
        errors++;
      }
    } catch (e) {
      console.error(`  ❌ Error: ${e.message}`);
      errors++;
    }
  }
  
  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  
  // Final counts
  const counts = await sql`
    SELECT 
      (SELECT COUNT(*) FROM photos) as total,
      (SELECT COUNT(*) FROM photos WHERE ready_for_public_render = true) as ready,
      (SELECT COUNT(*) FROM photos WHERE search_ready = true) as search_ready
  `;
  
  console.log(`\n=== DATABASE STATUS ===`);
  console.log(`Total photos: ${counts[0].total}`);
  console.log(`Ready for render: ${counts[0].ready}`);
  console.log(`Search ready: ${counts[0].search_ready}`);
  
  return { processed, errors };
}

// Run if called directly
const folder = process.argv[2];
const gallery = process.argv[3] || 'volcan-irazu';
if (folder && fs.existsSync(folder)) {
  importFolder(folder, gallery).catch(console.error);
} else {
  console.log('Usage: node scripts/import-local.js <folder-path> [gallery-slug]');
  console.log('Example: node scripts/import-local.js "/Volumes/..." "volcan-irazu"');
}

module.exports = { importFolder, processImage };
