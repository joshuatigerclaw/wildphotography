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
 * DB columns: thumb_url, small_url, medium_url, large_url, preview_url, original_r2_key
 */
function mapPhoto(row: any): PhotoDerivatives {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || '',
    description: row.description,
    // Map DB URLs to keys for consistency with the image helper
    // The image helper expects keys, but DB has URLs
    // We need to convert URLs to keys or update the helper
    // For now, let's extract the key from the URL or store directly
    thumb_r2_key: row.thumb_r2_key || null,
    small_r2_key: row.small_r2_key || null,
    medium_r2_key: row.medium_r2_key || null,
    large_r2_key: row.large_r2_key || null,
    preview_r2_key: row.preview_r2_key || null,
    original_r2_key: row.original_r2_key || null,
    // Legacy
    locationName: row.location,
  };
}

/**
 * Fetch all galleries
 */
export async function getGalleries(): Promise<Gallery[]> {
  const knownGalleries = [
    'surfing-costa-rica',
    'rivers', 
    'volcan-poas',
    'turtles'
  ];
  
  const galleries: Gallery[] = [];
  for (const slug of knownGalleries) {
    const data = await getGalleryBySlug(slug);
    if (data) galleries.push(data);
  }
  
  return galleries;
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
 * Only returns photos that have at least one valid derivative URL (not mock/test)
 */
export async function getPhotosByGallery(gallerySlug: string): Promise<PhotoDerivatives[]> {
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.location,
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
    // Convert URL to key: extract path after /derivatives/
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
 * Excludes mock/test images
 */
export async function getRecentPhotos(limit: number): Promise<PhotoDerivatives[]> {
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.location,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.preview_url,
      p.original_r2_key
    FROM photos p
    WHERE p.is_active = true 
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
 * Fetch photo by slug WITH derivative URLs
 */
export async function getPhotoBySlug(slug: string): Promise<PhotoDerivatives | null> {
  const rows = await queryNeon<any>(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.description,
      p.location,
      p.thumb_url,
      p.small_url,
      p.medium_url,
      p.large_url,
      p.preview_url,
      p.original_r2_key
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
    thumb_r2_key: r.thumb_url ? r.thumb_url.replace(/^.*\/derivatives\//, '') : null,
    small_r2_key: r.small_url ? r.small_url.replace(/^.*\/derivatives\//, '') : null,
    medium_r2_key: r.medium_url ? r.medium_url.replace(/^.*\/derivatives\//, '') : null,
    large_r2_key: r.large_url ? r.large_url.replace(/^.*\/derivatives\//, '') : null,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    locationName: r.location,
  };
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
      p.location,
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
    thumb_r2_key: r.thumb_url ? r.thumb_url.replace(/^.*\/derivatives\//, '') : null,
    small_r2_key: r.small_url ? r.small_url.replace(/^.*\/derivatives\//, '') : null,
    medium_r2_key: r.medium_url ? r.medium_url.replace(/^.*\/derivatives\//, '') : null,
    large_r2_key: r.large_url ? r.large_url.replace(/^.*\/derivatives\//, '') : null,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    locationName: r.location,
  }));
}
