/**
 * Database client for Neon
 * 
 * Uses direct SQL queries to avoid type conflicts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const sql = neon(DATABASE_URL);

export interface Photo {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  description_long?: string | null;
  keywords?: string | null;
  width?: number | null;
  height?: number | null;
  camera_model?: string | null;
  lat?: number | null;
  lon?: number | null;
  views_count?: number | null;
  dateTaken?: string | null;
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  locationName?: string | null;
}

export interface Gallery {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  coverPhotoUrl?: string | null;
  photoCount: number;
}

/**
 * Get all active galleries with photo counts
 */
export async function getGalleries(): Promise<Gallery[]> {
  const result = await sql(`
    SELECT 
      g.id, g.slug, g.name, g.description,
      p.thumb_url as "coverPhotoUrl",
      COUNT(gp.photo_id) as "photoCount"
    FROM galleries g
    LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id
    LEFT JOIN photos p ON g.cover_photo_id = p.id
    WHERE g.is_active = true
    GROUP BY g.id, p.thumb_url
    ORDER BY g.sort_order, g.name
  `);
  
  return (result as any[]).map(row => ({
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    coverPhotoUrl: row.coverPhotoUrl,
    photoCount: Number(row.photoCount),
  }));
}

/**
 * Get gallery by slug
 */
export async function getGalleryBySlug(slug: string): Promise<Gallery | null> {
  const result = await sql(`
    SELECT 
      g.id, g.slug, g.name, g.description,
      p.thumb_url as "coverPhotoUrl",
      COUNT(gp.photo_id) as "photoCount"
    FROM galleries g
    LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id
    LEFT JOIN photos p ON g.cover_photo_id = p.id
    WHERE g.slug = $1 AND g.is_active = true
    GROUP BY g.id, p.thumb_url
  `, [slug]);
  
  if (result.length === 0) return null;
  
  const row = result[0] as any;
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    coverPhotoUrl: row.coverPhotoUrl,
    photoCount: Number(row.photoCount),
  };
}

/**
 * Get photos for a gallery - only ready_for_public_render photos with valid derivatives
 */
export async function getPhotosByGallery(
  gallerySlug: string, 
  limit = 50, 
  offset = 0
): Promise<{ photos: Photo[]; total: number; hasMore: boolean }> {
  const countResult = await sql(`
    SELECT COUNT(*) as count
    FROM gallery_photos gp
    JOIN galleries g ON gp.gallery_id = g.id
    JOIN photos p ON gp.photo_id = p.id
    WHERE g.slug = $1 AND p.is_active = true AND p.ready_for_public_render = true
  `, [gallerySlug]);
  
  const total = Number(countResult[0]?.count || 0);
  
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_model, p.lat, p.lon, p.views_count,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = $1 AND p.is_active = true AND p.ready_for_public_render = true
    ORDER BY gp.sort_order, p.date_uploaded DESC
    LIMIT $2 OFFSET $3
  `, [gallerySlug, limit + 1, offset]);
  
  const hasMore = result.length > limit;
  const photos = (result as any[]).slice(0, limit).map(row => ({
    id: String(row.id),
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
    views_count: row.views_count,
    thumbUrl: row.thumb_url,
    smallUrl: row.small_url,
    mediumUrl: row.medium_url,
    largeUrl: row.large_url,
    locationName: row.location,
  }));
  
  return { photos, total, hasMore };
}

/**
 * Get photo by slug - with full metadata
 */
export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_model, p.lat, p.lon, p.views_count,
           p.date_taken, p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    WHERE p.slug = $1 AND p.is_active = true AND p.ready_for_public_render = true
    LIMIT 1
  `, [slug]);
  
  if (result.length === 0) return null;
  
  const row = result[0] as any;
  return {
    id: String(row.id),
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
    views_count: row.views_count,
    dateTaken: row.date_taken,
    thumbUrl: row.thumb_url,
    smallUrl: row.small_url,
    mediumUrl: row.medium_url,
    largeUrl: row.large_url,
    locationName: row.location,
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
    // Insert visit record
    await sql`
      INSERT INTO photo_visits (photo_id, slug, referrer, user_agent, visited_at)
      VALUES (${photoId}, ${slug}, ${referrer || null}, ${userAgent || null}, NOW())
    `;
    
    // Update aggregate count on photo
    await sql`
      UPDATE photos SET views_count = COALESCE(views_count, 0) + 1
      WHERE id = ${photoId}
    `;
  } catch (error) {
    console.error('[db] Visit record error:', error);
  }
}

/**
 * Get all photos for homepage - only ready_for_public_render photos with valid derivatives
 */
export async function getAllPhotos(limit = 20): Promise<Photo[]> {
  const result = await sql(`
    SELECT id, slug, title, description, description_long, keywords,
           width, height, camera_model, lat, lon, views_count,
           thumb_url, small_url, medium_url, large_url, location
    FROM photos
    WHERE is_active = true 
      AND ready_for_public_render = true
      AND (
        thumb_url IS NOT NULL 
        OR small_url IS NOT NULL 
        OR medium_url IS NOT NULL
        OR large_url IS NOT NULL
      )
    ORDER BY date_uploaded DESC
    LIMIT $1
  `, [limit]);
  
  return (result as any[]).map(row => ({
    id: String(row.id),
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
    views_count: row.views_count,
    thumbUrl: row.thumb_url,
    smallUrl: row.small_url,
    mediumUrl: row.medium_url,
    largeUrl: row.large_url,
    locationName: row.location,
  }));
}

/**
 * Get random photos for homepage variety
 */
export async function getRandomPhotos(limit = 12): Promise<Photo[]> {
  const result = await sql(`
    SELECT id, slug, title, description, description_long, keywords,
           width, height, camera_model, lat, lon, views_count,
           thumb_url, small_url, medium_url, large_url, location
    FROM photos
    WHERE is_active = true 
      AND ready_for_public_render = true
      AND (
        thumb_url IS NOT NULL 
        OR small_url IS NOT NULL 
        OR medium_url IS NOT NULL
        OR large_url IS NOT NULL
      )
    ORDER BY RANDOM()
    LIMIT $1
  `, [limit]);
  
  return (result as any[]).map(row => ({
    id: String(row.id),
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
    views_count: row.views_count,
    thumbUrl: row.thumb_url,
    smallUrl: row.small_url,
    mediumUrl: row.medium_url,
    largeUrl: row.large_url,
    locationName: row.location,
  }));
}

export default { 
  getGalleries, 
  getGalleryBySlug, 
  getPhotosByGallery, 
  getPhotoBySlug, 
  getAllPhotos,
  getRandomPhotos,
  recordPhotoVisit 
};
