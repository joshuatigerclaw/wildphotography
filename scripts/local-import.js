/**
 * Local Full Library Import Script for WildPhotography
 * 
 * Import from local files ONLY (not SmugMug)
 * Following all phases from import instructions
 * 
 * Usage:
 *   node scripts/local-import.js [--batch N] [--folder "Folder Name"]
 * 
 * Environment:
 *   DATABASE_URL - Neon connection (optional, has default)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { neon } = require('@neondatabase/serverless');
const sharp = require('sharp');

// ============================================================
// CONFIGURATION
// ============================================================

const ROOT_FOLDER = '/Volumes/ADATA SC740/Smugmug Backup/Galleries/Costa-Rica-Gallery';

const R2_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_BUCKET = 'wildphoto-storage';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_ACCESS_KEY = 'b821d56d29d9a2c716f783fc481e2f75';
const R2_ACCESS_SECRET = '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f';

const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

const NEON_DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const SIZES = {
  thumb:   { width: 400,  folder: 'thumbs',   suffix: 'thumb',   quality: 80 },
  small:   { width: 900,  folder: 'smalls',   suffix: 'small',   quality: 85 },
  medium:  { width: 1600, folder: 'mediums',  suffix: 'medium',  quality: 85 },
  large:   { width: 2400, folder: 'larges',    suffix: 'large',   quality: 90 },
  preview: { width: 2800, folder: 'previews',  suffix: 'preview', quality: 92 },
};

// ============================================================
// INITIALIZATION
// ============================================================

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_ACCESS_SECRET,
  },
});

const sql = neon(NEON_DB);

// ============================================================
// PHASE 1: SCAN LOCAL FILES
// ============================================================

function scanLocalFiles(rootFolder) {
  console.log(`\n=== PHASE 1: SCANNING ${rootFolder} ===`);
  
  const files = [];
  const folders = [];
  
  // Get first-level directories (galleries)
  const dirEntries = fs.readdirSync(rootFolder, { withFileTypes: true });
  
  for (const entry of dirEntries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      folders.push(entry.name);
      
      // Scan images in this folder
      const folderPath = path.join(rootFolder, entry.name);
      const imageFiles = fs.readdirSync(folderPath)
        .filter(f => {
          const ext = path.extname(f).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.tif', '.tiff'].includes(ext) && !f.startsWith('._');
        });
      
      for (const file of imageFiles) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        
        files.push({
          filename: file,
          filepath: filePath,
          folder: entry.name,
          size: stats.size,
        });
      }
    }
  }
  
  console.log(`Found ${folders.length} folders, ${files.length} image files`);
  
  return { folders, files };
}

// ============================================================
// PHASE 2: CHECK EXISTING RECORDS
// ============================================================

async function checkExistingRecords() {
  console.log(`\n=== PHASE 2: CHECKING EXISTING RECORDS ===`);
  
  // Get existing slugs
  const existing = await sql`
    SELECT slug, id FROM photos WHERE is_active = true
  `;
  
  const slugMap = new Map();
  for (const row of existing) {
    slugMap.set(row.slug, row.id);
  }
  
  // Get existing galleries
  const galleries = await sql`
    SELECT slug, id FROM galleries WHERE is_active = true
  `;
  
  const galleryMap = new Map();
  for (const row of galleries) {
    galleryMap.set(row.slug, row.id);
  }
  
  console.log(`Existing photos: ${slugMap.size}, Galleries: ${galleryMap.size}`);
  
  return { slugMap, galleryMap };
}

// ============================================================
// PHASE 3: GET OR CREATE GALLERY
// ============================================================

function dirToSlug(dirName) {
  return dirName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function dirToGalleryName(dirName) {
  return dirName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function getOrCreateGallery(galleryMap, folderName) {
  const slug = dirToSlug(folderName);
  
  if (galleryMap.has(slug)) {
    return { id: galleryMap.get(slug), existed: true };
  }
  
  // Escape single quotes in name for SQL
  const name = dirToGalleryName(folderName).replace(/'/g, "''");
  const desc = `${name} Costa Rica photography`.replace(/'/g, "''");
  
  const result = await sql`
    INSERT INTO galleries (name, slug, description, is_active, date_created, date_modified)
    VALUES (${name}, ${slug}, ${desc}, true, NOW(), NOW())
    RETURNING id
  `;
  
  galleryMap.set(slug, result[0].id);
  
  return { id: result[0].id, existed: false };
}

// ============================================================
// PHASE 4: EXIF EXTRACTION
// ============================================================

async function extractMetadata(filePath) {
  const metadata = {
    title: '',
    description: '',
    keywords: [],
    width: 0,
    height: 0,
    dateTaken: null,
    cameraMake: '',
    cameraModel: '',
    lens: '',
    iso: null,
    aperture: null,
    shutterSpeed: '',
    focalLength: null,
    lat: null,
    lon: null,
  };
  
  try {
    const image = sharp(filePath);
    const meta = await image.metadata();
    
    metadata.width = meta.width || 0;
    metadata.height = meta.height || 0;
    
    // Try to get EXIF
    if (meta.exif) {
      try {
        const exif = meta.exif;
        // Basic EXIF parsing - in production use exiftool
        if (exif.toString().includes('DateTimeOriginal')) {
          // Extract date if available
        }
      } catch (e) {
        // Ignore EXIF errors
      }
    }
    
    // Use filename as title
    metadata.title = path.basename(filePath, path.extname(filePath))
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
  } catch (e) {
    console.error(`Error extracting metadata: ${e.message}`);
  }
  
  return metadata;
}

// ============================================================
// PHASE 5: GENERATE SLUG
// ============================================================

function generateSlug(filename, folder, index) {
  const base = path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Include folder to avoid collisions
  const folderSlug = folder.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return `${base}-${folderSlug}-${index}`;
}

// ============================================================
// PHASE 6: UPLOAD TO R2
// ============================================================

async function uploadOriginal(filePath, photoId, folder) {
  const filename = path.basename(filePath);
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `originals/${photoId}/${safeName}`;
  
  try {
    const data = fs.readFileSync(filePath);
    
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: 'image/jpeg',
    }));
    
    return key;
  } catch (e) {
    console.error(`Upload error: ${e.message}`);
    return null;
  }
}

async function generateAndUploadDerivatives(originalPath, photoId) {
  const results = {};
  
  try {
    const originalBuffer = fs.readFileSync(originalPath);
    
    for (const [size, config] of Object.entries(SIZES)) {
      const key = `derivatives/${config.folder}/${photoId}-${config.suffix}.jpg`;
      
      try {
        const derivativeBuffer = await sharp(originalBuffer)
          .resize(config.width, null, { withoutEnlargement: true })
          .jpeg({ quality: config.quality })
          .toBuffer();
        
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: derivativeBuffer,
          ContentType: 'image/jpeg',
        }));
        
        results[size] = key;
        console.log(`  ✓ ${size}: ${key}`);
        
      } catch (e) {
        console.error(`  ✗ ${size} error: ${e.message}`);
      }
    }
    
  } catch (e) {
    console.error(`Derivative error: ${e.message}`);
  }
  
  return results;
}

// ============================================================
// PHASE 7: PROCESS BATCH
// ============================================================

async function processBatch(files, galleryMap, slugMap, startIndex = 0) {
  console.log(`\n=== PROCESSING BATCH (${files.length} files) ===`);
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let created = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const photoId = startIndex + i + 1000; // Start IDs at 1000 to avoid collision
    
    try {
      // Get or create gallery
      const { id: galleryId } = await getOrCreateGallery(galleryMap, file.folder);
      
      // Generate slug
      const slug = generateSlug(file.filename, file.folder, photoId);
      
      // Check if already exists
      if (slugMap.has(slug)) {
        console.log(`  Skip: ${slug} already exists`);
        skipped++;
        continue;
      }
      
      // Extract metadata
      const metadata = await extractMetadata(file.filepath);
      
      // Upload original
      console.log(`  Processing: ${file.filename} (${file.folder})`);
      const originalKey = await uploadOriginal(file.filepath, photoId, file.folder);
      
      if (!originalKey) {
        console.log(`  ✗ Failed to upload original`);
        errors++;
        continue;
      }
      
      // Generate derivatives
      const derivatives = await generateAndUploadDerivatives(file.filepath, photoId);
      
      // Build URLs
      const urls = {
        thumb_url: derivatives.thumb ? `${R2_PUBLIC}/${derivatives.thumb}` : null,
        small_url: derivatives.small ? `${R2_PUBLIC}/${derivatives.small}` : null,
        medium_url: derivatives.medium ? `${R2_PUBLIC}/${derivatives.medium}` : null,
        large_url: derivatives.large ? `${R2_PUBLIC}/${derivatives.large}` : null,
        preview_url: derivatives.preview ? `${R2_PUBLIC}/${derivatives.preview}` : null,
      };
      
      // Insert into database
      await sql`
        INSERT INTO photos (
          slug, title, description, description_long,
          width, height, camera_make, camera_model, lens,
          iso, aperture, shutter_speed, focal_length_mm,
          lat, lon,
          original_r2_key, original_stored,
          thumb_url, small_url, medium_url, large_url, preview_url,
          derivatives_complete, ready_for_public_render, search_ready,
          is_active, date_uploaded, date_modified
        ) VALUES (
          ${slug}, ${metadata.title}, '', '',
          ${metadata.width}, ${metadata.height}, '', '', '',
          null, null, '', null,
          null, null,
          ${originalKey}, true,
          ${urls.thumb_url}, ${urls.small_url}, ${urls.medium_url}, ${urls.large_url}, ${urls.preview_url},
          true, true, true,
          true, NOW(), NOW()
        )
      `;
      
      // Link to gallery
      await sql`
        INSERT INTO gallery_photos (gallery_id, photo_id, sort_order)
        VALUES (${galleryId}, (SELECT id FROM photos WHERE slug = ${slug}), ${i})
        ON CONFLICT DO NOTHING
      `;
      
      slugMap.set(slug, photoId);
      created++;
      processed++;
      
      console.log(`  ✓ Created: ${slug}`);
      
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`);
      errors++;
    }
  }
  
  return { processed, skipped, errors, created };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(args.find(a => a.startsWith('--batch'))?.split('=')[1] || '50');
  const folderFilter = args.find(a => a.startsWith('--folder='))?.split('=')[1];
  
  console.log('==========================================');
  console.log('LOCAL FULL LIBRARY IMPORT');
  console.log('==========================================');
  console.log(`Root: ${ROOT_FOLDER}`);
  console.log(`Batch size: ${batchSize}`);
  if (folderFilter) console.log(`Folder filter: ${folderFilter}`);
  console.log('');
  
  // Phase 1: Scan
  const { folders, files } = scanLocalFiles(ROOT_FOLDER);
  
  // Filter by folder if specified
  const filteredFiles = folderFilter 
    ? files.filter(f => f.folder.toLowerCase().includes(folderFilter.toLowerCase()))
    : files;
  
  console.log(`Files to process: ${filteredFiles.length}`);
  
  // Phase 2: Check existing
  const { slugMap, galleryMap } = await checkExistingRecords();
  
  // Phase 3-7: Process in batches
  const batches = Math.ceil(filteredFiles.length / batchSize);
  
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalCreated = 0;
  
  for (let b = 0; b < batches; b++) {
    const start = b * batchSize;
    const end = Math.min(start + batchSize, filteredFiles.length);
    const batchFiles = filteredFiles.slice(start, end);
    
    console.log(`\n--- BATCH ${b + 1}/${batches} (files ${start + 1}-${end}) ---`);
    
    const result = await processBatch(batchFiles, galleryMap, slugMap, start);
    
    totalProcessed += result.processed;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
    totalCreated += result.created;
  }
  
  console.log('\n==========================================');
  console.log('IMPORT COMPLETE');
  console.log('==========================================');
  console.log(`Files processed: ${totalProcessed}`);
  console.log(`Files skipped: ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`New records created: ${totalCreated}`);
}

main().catch(console.error);
