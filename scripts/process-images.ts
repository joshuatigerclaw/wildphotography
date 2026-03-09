/**
 * Image Processing Pipeline - Batch Processor
 * 
 * This script processes photos in batches:
 * 1. Fetch photos from DB that need processing
 * 2. Download from SmugMug (when OAuth is valid)
 * 3. Upload to R2
 * 4. Generate derivatives
 * 5. Update DB
 * 
 * Usage: npx ts-node scripts/process-images.ts [batch-size]
 * 
 * Environment:
 * - CLOUDFLARE_API_TOKEN - for R2 uploads
 * - DATABASE_URL - Neon connection
 */

import { neon } from '@neondatabase/serverless';

// Config
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'VcSgOA9VsIcjE85VD1nAKiAMenj-1SB255hsnvE0';
const R2_ACCOUNT = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_BUCKET = 'wildphoto-storage';

const sql = neon(DATABASE_URL);

// Derivatives configuration
const DERIVATIVES = [
  { name: 'thumbs', width: 400, quality: 80 },
  { name: 'small', width: 900, quality: 85 },
  { name: 'medium', width: 1600, quality: 90 },
  { name: 'large', width: 2400, quality: 92 },
];

interface Photo {
  id: number;
  smugmug_key: string | null;
  slug: string;
  title: string;
  original_r2_key: string | null;
  thumb_r2_key: string | null;
}

/**
 * Get photos needing processing
 */
async function getPhotosNeedingProcessing(limit: number): Promise<Photo[]> {
  const rows = await sql(`
    SELECT id, smugmug_key, slug, title, original_r2_key, thumb_r2_key
    FROM photos
    WHERE is_active = true
    AND smugmug_key IS NOT NULL
    AND (original_r2_key IS NULL OR thumb_r2_key IS NULL)
    ORDER BY id
    LIMIT $1
  `, [limit]);
  
  return rows;
}

/**
 * Update photo with R2 keys
 */
async function updatePhotoWithKeys(
  photoId: number,
  originalKey: string,
  derivativeKeys: Record<string, string>
): Promise<void> {
  await sql(`
    UPDATE photos SET
      original_r2_key = $1,
      thumb_r2_key = $2,
      small_r2_key = $3,
      medium_r2_key = $4,
      large_r2_key = $5,
      date_modified = NOW()
    WHERE id = $6
  `, [
    originalKey,
    derivativeKeys.thumb,
    derivativeKeys.small,
    derivativeKeys.medium,
    derivativeKeys.large,
    photoId
  ]);
}

/**
 * Upload to R2
 */
async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<boolean> {
  try {
    const url = `https://${R2_ACCOUNT}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Authorization': `Bearer ${R2_TOKEN}`,
      },
      body: data,
    });
    
    return response.ok;
  } catch (error) {
    console.error(`[r2] Upload failed:`, error);
    return false;
  }
}

/**
 * Download from source (placeholder - needs valid SmugMug OAuth)
 */
async function downloadImage(smugmugKey: string): Promise<Buffer | null> {
  // TODO: Implement with valid OAuth token
  console.log(`[download] Would download: ${smugmugKey}`);
  return null;
}

/**
 * Generate derivative (placeholder - needs image processing library)
 */
async function generateDerivative(
  sourceData: Buffer,
  width: number,
  quality: number
): Promise<Buffer | null> {
  // TODO: Implement with sharp or similar
  console.log(`[process] Would generate: ${width}px, quality ${quality}`);
  return sourceData; // Placeholder
}

/**
 * Process a single photo
 */
async function processPhoto(photo: Photo): Promise<boolean> {
  console.log(`\n[${photo.id}] Processing: ${photo.title}`);
  console.log(`  SmugMug Key: ${photo.smugmug_key}`);
  
  // Step 1: Download original
  let originalData: Buffer | null = null;
  
  if (photo.original_r2_key) {
    console.log(`  Original already exists: ${photo.original_r2_key}`);
    // Would fetch from R2
  } else if (photo.smugmug_key) {
    originalData = await downloadImage(photo.smugmug_key);
    if (!originalData) {
      console.log(`  ✗ Download failed - need valid OAuth`);
      return false;
    }
    
    // Upload original
    const originalKey = `originals/${photo.slug}.jpg`;
    const uploaded = await uploadToR2(originalKey, originalData, 'image/jpeg');
    if (!uploaded) {
      console.log(`  ✗ Upload failed`);
      return false;
    }
    console.log(`  ✓ Uploaded: ${originalKey}`);
  }
  
  // Step 2: Generate derivatives
  if (!originalData) {
    console.log(`  ✗ No source data`);
    return false;
  }
  
  const keys: Record<string, string> = {};
  
  for (const deriv of DERIVATIVES) {
    const derivData = await generateDerivative(originalData, deriv.width, deriv.quality);
    if (derivData) {
      const key = `derivatives/${deriv.name}/${photo.slug}-${deriv.name}.jpg`;
      const uploaded = await uploadToR2(key, derivData, 'image/jpeg');
      if (uploaded) {
        keys[deriv.name] = key;
        console.log(`  ✓ ${deriv.name}: ${key}`);
      }
    }
  }
  
  // Step 3: Update database
  if (keys.thumb) {
    await updatePhotoWithKeys(
      photo.id,
      `originals/${photo.slug}.jpg`,
      keys
    );
    console.log(`  ✓ DB updated`);
    return true;
  }
  
  return false;
}

/**
 * Main batch processor
 */
async function main() {
  const batchSize = parseInt(process.argv[2]) || 5;
  
  console.log(`=== Image Processing Pipeline ===`);
  console.log(`Batch size: ${batchSize}\n`);
  
  // Get photos needing processing
  const photos = await getPhotosNeedingProcessing(batchSize);
  
  if (photos.length === 0) {
    console.log('No photos need processing!');
    return;
  }
  
  console.log(`Found ${photos.length} photos to process\n`);
  
  let processed = 0;
  let failed = 0;
  
  for (const photo of photos) {
    const success = await processPhoto(photo);
    if (success) {
      processed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n=== Complete ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining: ${photos.length - processed - failed}`);
}

main().catch(console.error);
