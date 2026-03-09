/**
 * Import Pipeline Services
 * 
 * Modular services for:
 * - Metadata import
 * - Original download
 * - Derivative generation
 * - Database update
 * - Search indexing
 */

import { neon } from '@neondatabase/serverless';
import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const NEON_CONNECTION = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_ENDPOINT = 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com';
const R2_BUCKET = 'wildphoto-storage';
const R2_PUBLIC_URL = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

const sql = neon(NEON_CONNECTION);

// R2 client
const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || '3ec62f93675c404fe4a9a4949e38e5e5',
    secretAccessKey: process.env.R2_SECRET_KEY || '',
  },
});

const DERIVATIVE_SIZES = {
  thumb: { width: 400, suffix: 'thumb', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 85 },
  large: { width: 2400, suffix: 'large', quality: 90 },
};

/**
 * Check if photo already processed (idempotency)
 */
export async function isPhotoProcessed(slug: string): Promise<boolean> {
  const result = await sql`
    SELECT original_r2_key FROM photos 
    WHERE slug = ${slug} 
    AND original_r2_key IS NOT NULL 
    AND original_r2_key != ''
  `;
  return result.length > 0;
}

/**
 * Get photo by slug
 */
export async function getPhotoBySlug(slug: string) {
  const result = await sql`
    SELECT * FROM photos WHERE slug = ${slug}
  `;
  return result[0] || null;
}

/**
 * Download original from SmugMug
 */
export async function downloadFromSmugMug(imageUri: string, oauthToken: string, oauthSecret: string): Promise<Buffer | null> {
  // Implementation would use OAuth-signed request to SmugMug
  console.log('[import] Would download from:', imageUri);
  return null;
}

/**
 * Get original from R2
 */
export async function getOriginalFromR2(key: string): Promise<Buffer | null> {
  try {
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const resp = await r2.send(cmd);
    if (!resp.Body) return null;
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (e) {
    console.error('[import] Error getting original:', e);
    return null;
  }
}

/**
 * Upload to R2
 */
export async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<boolean> {
  try {
    const cmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    await r2.send(cmd);
    return true;
  } catch (e) {
    console.error('[import] Error uploading:', e);
    return false;
  }
}

/**
 * Generate derivative from original
 */
export async function generateDerivative(
  originalData: Buffer,
  sizeName: keyof typeof DERIVATIVE_SIZES
): Promise<Buffer | null> {
  const config = DERIVATIVE_SIZES[sizeName];
  if (!config) return null;
  
  try {
    return await sharp(originalData)
      .resize(config.width, null, { withoutEnlargement: true })
      .jpeg({ quality: config.quality })
      .toBuffer();
  } catch (e) {
    console.error('[import] Sharp error:', e);
    return null;
  }
}

/**
 * Update photo in database
 */
export async function updatePhotoDerivatives(
  slug: string,
  derivatives: {
    thumb_r2_key?: string;
    small_r2_key?: string;
    medium_r2_key?: string;
    large_r2_key?: string;
  }
): Promise<boolean> {
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    
    if (derivatives.thumb_r2_key) {
      updates.push(`thumb_url = $${idx++}`);
      values.push(`${R2_PUBLIC_URL}/derivatives/${derivatives.thumb_r2_key}`);
    }
    if (derivatives.small_r2_key) {
      updates.push(`small_url = $${idx++}`);
      values.push(`${R2_PUBLIC_URL}/derivatives/${derivatives.small_r2_key}`);
    }
    if (derivatives.medium_r2_key) {
      updates.push(`medium_url = $${idx++}`);
      values.push(`${R2_PUBLIC_URL}/derivatives/${derivatives.medium_r2_key}`);
    }
    if (derivatives.large_r2_key) {
      updates.push(`large_url = $${idx++}`);
      values.push(`${R2_PUBLIC_URL}/derivatives/${derivatives.large_r2_key}`);
    }
    
    if (updates.length === 0) return false;
    
    values.push(slug);
    await sql`UPDATE photos SET ${sql(updates)} = ${sql(values)} WHERE slug = ${slug}`;
    return true;
  } catch (e) {
    console.error('[import] DB update error:', e);
    return false;
  }
}

/**
 * Index in Typesense
 */
export async function indexInTypesense(
  photo: {
    slug: string;
    title: string;
    description?: string;
    keywords?: string;
    location?: string;
  }
): Promise<boolean> {
  console.log('[import] Would index in Typesense:', photo.slug);
  return true;
}

/**
 * Process single photo - full pipeline
 */
export async function processPhoto(
  slug: string,
  originalKey: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[import] Processing: ${slug}`);
  
  // Check idempotency
  const processed = await isPhotoProcessed(slug);
  if (processed) {
    console.log(`[import] Already processed: ${slug}`);
    return { success: true };
  }
  
  // Get original from R2
  const original = await getOriginalFromR2(originalKey);
  if (!original) {
    return { success: false, error: 'Original not found' };
  }
  
  // Generate derivatives
  const derivatives: Record<string, string> = {};
  
  for (const [size, config] of Object.entries(DERIVATIVE_SIZES)) {
    const derivative = await generateDerivative(original, size as keyof typeof DERIVATIVE_SIZES);
    if (derivative) {
      const key = `derivatives/${size}s/${slug}-${config.suffix}.jpg`;
      const uploaded = await uploadToR2(key, derivative, 'image/jpeg');
      if (uploaded) {
        derivatives[`${size}_r2_key`] = key;
      }
    }
  }
  
  // Update database
  await updatePhotoDerivatives(slug, derivatives);
  
  // Index in Typesense
  const photo = await getPhotoBySlug(slug);
  if (photo) {
    await indexInTypesense({
      slug: photo.slug,
      title: photo.title,
      description: photo.description || undefined,
      keywords: photo.keywords || undefined,
      location: photo.location || undefined,
    });
  }
  
  return { success: true };
}
