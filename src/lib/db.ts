/**
 * Neon database client for Worker
 * 
 * Uses Neon serverless driver for direct DB queries
 */

import type { PhotoDerivatives, Gallery } from '../types';
import { neon } from '@neondatabase/serverless';

// Neon connection string (from env)
const NEON_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

/**
 * Execute SQL query via Neon serverless
 */
export async function queryNeon<T>(sql: string): Promise<T[]> {
  try {
    const sqlFn = neon(NEON_CONNECTION);
    const rows = await sqlFn(sql);
    return rows as T[];
  } catch (error) {
    console.error('[db] Query error:', error);
    return [];
  }
}

/**
 * Map DB row to PhotoDerivatives
 */
function mapPhoto(row: any): PhotoDerivatives {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || '',
    description: row.description,
    description_long: row.description_long,
    keywords: row.keywords,
    width: row.width,
    height: row.height,
    camera_model: row.camera_model,
    lat: row.lat,
    lon: row.lon,
    // Legacy
    locationName: row.location,
  };
}

/**
 * Fetch all galleries
 */
export async function getGalleries(): Promise<Gallery[]> {
  // Fetch all active galleries from database
  const rows = await queryNeon<any>(`
    SELECT DISTINCT g.id, g.slug, g.name, g.description, g.cover_photo_id
    FROM galleries g
    JOIN gallery_photos gp ON g.id = gp.gallery_id
    JOIN photos p ON gp.photo_id = p.id
    WHERE g.is_active = true AND p.ready_for_public_render = true
    ORDER BY g.name
  `);
  
  return rows.map(r => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    coverPhotoId: r.cover_photo_id,
  }));
}

/**
 * Fetch gallery by slug with photos
 */
export async function getGalleryBySlug(slug: string): Promise<Gallery | null> {
  const rows = await queryNeon<any>(`
    SELECT DISTINCT g.id, g.slug, g.name, g.description
    FROM galleries g
    JOIN gallery_photos gp ON g.id = gp.gallery_id
    JOIN photos p ON gp.photo_id = p.id
    WHERE g.slug = '${slug.replace(/'/g, "''")}'
    LIMIT 1
  `);
  
  if (rows.length === 0) return null;
  
  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
  };
}

/**
 * Fetch photos by gallery slug WITH derivative URLs
 * Only returns photos that are ready_for_public_render
 */
export async function getPhotosByGallery(gallerySlug: string): Promise<PhotoDerivatives[]> {
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.description_long,
      p.keywords,
      p.location,
      p.width,
      p.height,
      p.camera_model,
      p.lat,
      p.lon,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.preview_url,
      p.original_r2_key
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = '${gallerySlug.replace(/'/g, "''")}' 
      AND p.is_active = true
      AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL AND p.thumb_url != '' AND p.thumb_url NOT LIKE '%scarlet-macaw-test%'
           OR p.small_url IS NOT NULL AND p.small_url != '' AND p.small_url NOT LIKE '%scarlet-macaw-test%'
           OR p.medium_url IS NOT NULL AND p.medium_url != '' AND p.medium_url NOT LIKE '%scarlet-macaw-test%')
    ORDER BY gp.sort_order, p.date_taken DESC
    LIMIT 20
  `);
  
  // Map URLs to derivative keys
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title || '',
    description: r.description,
    description_long: r.description_long,
    keywords: r.keywords,
    width: r.width,
    height: r.height,
    camera_model: r.camera_model,
    lat: r.lat,
    lon: r.lon,
    thumb_r2_key: r.thumb_url ? r.thumb_url.replace(/^.*\/derivatives\//, '') : null,
    small_r2_key: r.small_url ? r.small_url.replace(/^.*\/derivatives\//, '') : null,
    medium_r2_key: r.medium_url ? r.medium_url.replace(/^.*\/derivatives\//, '') : null,
    large_r2_key: r.large_url ? r.large_url.replace(/^.*\/derivatives\//, '') : null,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    locationName: r.location,
  }));
}

/**
 * Fetch recent photos for homepage WITH derivative URLs
 * Only returns ready_for_public_render photos
 */
export async function getRecentPhotos(limit: number): Promise<PhotoDerivatives[]> {
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.description_long,
      p.keywords,
      p.location,
      p.width,
      p.height,
      p.camera_model,
      p.lat,
      p.lon,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.preview_url,
      p.original_r2_key
    FROM photos p
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND (
        (p.thumb_url IS NOT NULL AND p.thumb_url != '' AND p.thumb_url NOT LIKE '%scarlet-macaw-test%')
        OR (p.small_url IS NOT NULL AND p.small_url != '' AND p.small_url NOT LIKE '%scarlet-macaw-test%')
        OR (p.medium_url IS NOT NULL AND p.medium_url != '' AND p.medium_url NOT LIKE '%scarlet-macaw-test%')
        OR (p.large_url IS NOT NULL AND p.large_url != '' AND p.large_url NOT LIKE '%scarlet-macaw-test%')
      )
    ORDER BY p.date_taken DESC
    LIMIT ${limit}
  `);
  
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title || '',
    description: r.description,
    description_long: r.description_long,
    keywords: r.keywords,
    width: r.width,
    height: r.height,
    camera_model: r.camera_model,
    lat: r.lat,
    lon: r.lon,
    thumb_r2_key: r.thumb_url ? r.thumb_url.replace(/^.*\/derivatives\//, '') : null,
    small_r2_key: r.small_url ? r.small_url.replace(/^.*\/derivatives\//, '') : null,
    medium_r2_key: r.medium_url ? r.medium_url.replace(/^.*\/derivatives\//, '') : null,
    large_r2_key: r.large_url ? r.large_url.replace(/^.*\/derivatives\//, '') : null,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    locationName: r.location,
  }));
}

/**
 * Fetch random photos for homepage - uses DB random ordering
 * Only returns ready_for_public_render photos with valid derivatives
 */
export async function getRandomPhotos(limit: number): Promise<PhotoDerivatives[]> {
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.description_long,
      p.keywords,
      p.location,
      p.width,
      p.height,
      p.camera_model,
      p.lat,
      p.lon,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.preview_url,
      p.original_r2_key
    FROM photos p
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND (
        (p.thumb_url IS NOT NULL AND p.thumb_url != '' AND p.thumb_url NOT LIKE '%scarlet-macaw-test%')
        OR (p.small_url IS NOT NULL AND p.small_url != '' AND p.small_url NOT LIKE '%scarlet-macaw-test%')
        OR (p.medium_url IS NOT NULL AND p.medium_url != '' AND p.medium_url NOT LIKE '%scarlet-macaw-test%')
        OR (p.large_url IS NOT NULL AND p.large_url != '' AND p.large_url NOT LIKE '%scarlet-macaw-test%')
      )
    ORDER BY RANDOM()
    LIMIT ${limit}
  `);
  
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title || '',
    description: r.description,
    description_long: r.description_long,
    keywords: r.keywords,
    width: r.width,
    height: r.height,
    camera_model: r.camera_model,
    lat: r.lat,
    lon: r.lon,
    thumb_r2_key: r.thumb_url ? r.thumb_url.replace(/^.*\/derivatives\//, '') : null,
    small_r2_key: r.small_url ? r.small_url.replace(/^.*\/derivatives\//, '') : null,
    medium_r2_key: r.medium_url ? r.medium_url.replace(/^.*\/derivatives\//, '') : null,
    large_r2_key: r.large_url ? r.large_url.replace(/^.*\/derivatives\//, '') : null,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    locationName: r.location,
  }));
}

/**
 * Fetch photo by slug WITH derivative URLs and full metadata
 */
export async function getPhotoBySlug(slug: string): Promise<PhotoDerivatives | null> {
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.description_long,
      p.keywords,
      p.location,
      p.width,
      p.height,
      p.camera_model,
      p.lat,
      p.lon,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.preview_url,
      p.original_r2_key,
      p.views_count
    FROM photos p
    WHERE p.slug = '${slug.replace(/'/g, "''")}' AND p.is_active = true
    LIMIT 1
  `);
  
  if (rows.length === 0) return null;
  
  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    title: r.title || '',
    description: r.description,
    description_long: r.description_long,
    keywords: r.keywords,
    width: r.width,
    height: r.height,
    camera_model: r.camera_model,
    lat: r.lat,
    lon: r.lon,
    thumb_r2_key: r.thumb_url ? r.thumb_url.replace(/^.*\/derivatives\//, '') : null,
    small_r2_key: r.small_url ? r.small_url.replace(/^.*\/derivatives\//, '') : null,
    medium_r2_key: r.medium_url ? r.medium_url.replace(/^.*\/derivatives\//, '') : null,
    large_r2_key: r.large_url ? r.large_url.replace(/^.*\/derivatives\//, '') : null,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    locationName: r.location,
    views_count: r.views_count,
  };
}

/**
 * Record a photo visit
 */
export async function recordPhotoVisit(
  photoId: number, 
  slug: string, 
  referrer?: string, 
  userAgent?: string
): Promise<void> {
  try {
    const sqlFn = neon(NEON_CONNECTION);
    
    // Insert visit record
    await sqlFn`
      INSERT INTO photo_visits (photo_id, slug, referrer, user_agent, visited_at)
      VALUES (${photoId}, ${slug}, ${referrer || null}, ${userAgent || null}, NOW())
    `;
    
    // Update aggregate count on photo
    await sqlFn`
      UPDATE photos SET views_count = COALESCE(views_count, 0) + 1
      WHERE id = ${photoId}
    `;
  } catch (error) {
    console.error('[db] Visit record error:', error);
  }
}

/**
 * Search photos WITH derivative URLs
 */
export async function searchPhotos(query: string, limit: number): Promise<PhotoDerivatives[]> {
  const safeQuery = query.replace(/'/g, "''").toLowerCase();
  
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.description_long,
      p.keywords,
      p.location,
      p.width,
      p.height,
      p.camera_model,
      p.lat,
      p.lon,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.preview_url,
      p.original_r2_key
    FROM photos p
    WHERE p.is_active = true 
      AND (
        LOWER(p.title) LIKE '%${safeQuery}%'
        OR LOWER(p.description) LIKE '%${safeQuery}%'
        OR LOWER(p.keywords) LIKE '%${safeQuery}%'
      )
      AND (
        p.thumb_url IS NOT NULL 
        OR p.small_url IS NOT NULL 
        OR p.medium_url IS NOT NULL
        OR p.large_url IS NOT NULL
        OR p.preview_url IS NOT NULL
      )
    ORDER BY p.date_taken DESC
    LIMIT ${limit}
  `);
  
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title || '',
    description: r.description,
    description_long: r.description_long,
    keywords: r.keywords,
    width: r.width,
    height: r.height,
    camera_model: r.camera_model,
    lat: r.lat,
    lon: r.lon,
    thumb_r2_key: r.thumb_url ? r.thumb_url.replace(/^.*\/derivatives\//, '') : null,
    small_r2_key: r.small_url ? r.small_url.replace(/^.*\/derivatives\//, '') : null,
    medium_r2_key: r.medium_url ? r.medium_url.replace(/^.*\/derivatives\//, '') : null,
    large_r2_key: r.large_url ? r.large_url.replace(/^.*\/derivatives\//, '') : null,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    locationName: r.location,
  }));
}
