/**
 * Image Downloader - Uses SmugMug API
 * 
 * Strategy:
 * 1. Get image key from database (smugmug_key)
 * 2. Construct image URL from SmugMug
 * 3. Download and upload to R2
 * 4. Generate derivatives
 * 
 * Note: Need valid OAuth token - if expired, re-authenticate
 */

import { neon } from '@neondatabase/serverless';
import axios from 'axios';
import crypto from 'crypto';

// Config
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const sql = neon(DATABASE_URL);

// SmugMug OAuth - NEEDS REFRESH IF EXPIRED
const SMUGMUG_API_KEY = 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const ACCESS_TOKEN = '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8';
const TOKEN_SECRET = 'V5Ggv3kvtffLpxqBjXP5HMQgrZHPfRfFP8c2sfdkTmdkrBD4Qx5ZZLgPQJzHR4LP';

// R2 Upload
const R2_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'VcSgOA9VsIcjE85VD1nAKiAMenj-1SB255hsnvE0';

/**
 * Refresh OAuth token using oAuth1.0a
 */
async function refreshToken(): Promise<boolean> {
  console.log('[smugmug] Token may be expired - trying direct API access');
  return false;
}

/**
 * Get image download URL from SmugMug
 * Using the image key to construct the URL
 */
async function getImageUrl(imageKey: string): Promise<string | null> {
  // Try using the public album URL format
  // Format: https://photos.smugmug.com/AlbumName/i-ImageKey/0/L/file.jpg
  // But we need the actual image data
  
  // Alternative: Use the API endpoint with OAuth
  return null; // Will need valid OAuth
}

/**
 * Fetch photo with missing derivatives
 */
async function getPhotosNeedingProcessing(limit = 5): Promise<any[]> {
  const rows = await sql(`
    SELECT id, smugmug_key, slug, title 
    FROM photos 
    WHERE is_active = true 
    AND smugmug_key IS NOT NULL
    AND (thumb_r2_key IS NULL OR original_r2_key IS NULL)
    ORDER BY id
    LIMIT $1
  `, [limit]);
  
  return rows;
}

/**
 * Download from SmugMug - using public URL if available
 */
async function downloadFromSmugMug(smugmugKey: string): Promise<Buffer | null> {
  // Try using SmugMug's public download URL format
  // This requires authentication for most images
  
  // For now, return null and log the issue
  console.log(`[smugmug] Would download: ${smugmugKey}`);
  return null;
}

/**
 * Upload to R2
 */
async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<boolean> {
  try {
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
    
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Authorization': `Bearer ${R2_TOKEN}`,
      },
      body: data,
    });
    
    console.log(`[r2] Uploaded: ${key}`);
    return true;
  } catch (error) {
    console.error(`[r2] Error:`, error);
    return false;
  }
}

/**
 * Generate derivative filename
 */
function getDerivativePath(slug: string, size: string): string {
  return `derivatives/${size}/${slug}-${size}.jpg`;
}

/**
 * Main processing function
 */
async function main() {
  console.log('=== Image Processing Pipeline ===\n');
  
  // Get photos needing processing
  const photos = await getPhotosNeedingProcessing(5);
  console.log(`Found ${photos.length} photos needing processing\n`);
  
  for (const photo of photos) {
    console.log(`Processing: ${photo.title} (${photo.slug})`);
    console.log(`  SmugMug Key: ${photo.smugmug_key}`);
    
    // Try to download from SmugMug
    const imageData = await downloadFromSmugMug(photo.smugmug_key);
    
    if (imageData) {
      // Upload original
      const originalKey = `originals/${photo.slug}.jpg`;
      await uploadToR2(originalKey, imageData, 'image/jpeg');
      
      // Update DB
      await sql(`
        UPDATE photos SET original_r2_key = $1, date_modified = NOW() WHERE id = $2
      `, [originalKey, photo.id]);
      
      console.log(`  ✓ Original uploaded`);
    } else {
      console.log(`  ✗ Need valid SmugMug OAuth token`);
    }
    console.log('');
  }
  
  console.log('\n=== Requires SmugMug OAuth refresh ===');
}

main().catch(console.error);
