/**
 * Neon database client for Worker
 * 
 * Neon v1.x requires TAGGED TEMPLATE syntax: sql`SELECT ${val}` NOT sql("SELECT $1", [val]).
 * All callers MUST use template literal syntax: queryNeon`SELECT ${val}`
 */

import { neon } from '@neondatabase/serverless';

const NEON_CONNECTION = process.env.NEON_CONNECTION || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

/**
 * Execute SQL query via Neon serverless (tagged template syntax).
 * Usage: queryNeon`SELECT ${val} FROM ...`
 */
export async function queryNeon<T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> {
  try {
    const sqlFn = neon(NEON_CONNECTION);
    const result = await sqlFn(strings, ...values);
    return (result as T[]) ?? [];
  } catch (error: any) {
    if (error?.message?.includes('timed out') || error?.message?.includes('Timeout')) {
      console.error('[db] Query timeout');
    } else {
      console.error('[db] Query error:', error?.message || error);
    }
    return [];
  }
}

/**
 * Execute SQL with a hard timeout for heavy queries (LATERAL joins, etc).
 * Accepts tagged template syntax so LIMIT/OFFSET values are safely interpolated.
 */
export async function queryWithTimeout<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  const timeoutMs = 8000;
  const timeout = new Promise<[]>((_, reject) =>
    setTimeout(() => reject(new Error(`[db] Query timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  try {
    const sqlFn = neon(NEON_CONNECTION);
    const result = await Promise.race([sqlFn(strings, ...values), timeout]);
    return ((result as T[]) ?? []);
  } catch (error: any) {
    if (error.message?.includes('timed out')) {
      console.error('[db] Query timeout (LATERAL join may be slow)');
    } else {
      console.error('[db] Query error:', error?.message || error);
    }
    return [];
  }
}

// ============================================================
// Gallery helpers
// ============================================================

/**
 * Fetch all active galleries with cover photo and photo count.
 */
export async function getGalleries(): Promise<any[]> {
  return queryNeon<any>`
    WITH gallery_stats AS (
      SELECT gp.gallery_id, COUNT(gp.photo_id) as photo_count
      FROM gallery_photos gp
      JOIN photos p ON gp.photo_id = p.id
      WHERE p.is_active = true AND p.ready_for_public_render = true
      GROUP BY gp.gallery_id
    )
    SELECT
      g.id, g.slug, g.name, g.description, g.cover_photo_id,
      p.thumb_url, p.small_url, p.medium_url, p.large_url,
      COALESCE(gs.photo_count, 0) as photo_count
    FROM galleries g
    LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id
      AND gp.photo_id = g.cover_photo_id
    LEFT JOIN photos p ON gp.photo_id = p.id
      AND p.is_active = true AND p.ready_for_public_render = true
    LEFT JOIN gallery_stats gs ON g.id = gs.gallery_id
    WHERE g.is_active = true
    ORDER BY g.sort_order NULLS LAST, g.name
  `;
}

/**
 * Fetch gallery by ID (includes parent_gallery_id for internal linking)
 */
export async function getGalleryById(id: number): Promise<any | null> {
  const rows = await queryNeon<any>`SELECT id, slug, name, description, parent_gallery_id FROM galleries WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * Fetch gallery by slug with photos
 */
export async function getGalleryBySlug(slug: string): Promise<any | null> {
  const rows = await queryNeon<any>`SELECT DISTINCT g.id, g.slug, g.name, g.description, g.parent_gallery_id FROM galleries g LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id LEFT JOIN photos p ON gp.photo_id = p.id AND p.is_active = true WHERE g.slug = ${slug} LIMIT 1`;
  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * Get related galleries: siblings (same parent) + same-region galleries
 */
export async function getRelatedGalleries(galleryId: number, parentGalleryId: number | null, limit: number = 5): Promise<any[]> {
  if (parentGalleryId) {
    return queryNeon<any>`SELECT g.id, g.slug, g.name, g.description, g.parent_gallery_id FROM galleries g WHERE g.is_active = true AND g.id != ${galleryId} AND g.parent_gallery_id = ${parentGalleryId} ORDER BY g.name LIMIT ${limit}`;
  }
  return queryNeon<any>`SELECT g.id, g.slug, g.name, g.description, g.parent_gallery_id FROM galleries g WHERE g.is_active = true AND g.id != ${galleryId} ORDER BY g.name LIMIT ${limit}`;
}

/**
 * Get distinct species found in a gallery's photos
 */
export async function getSpeciesForGallery(gallerySlug: string, limit: number = 5): Promise<string[]> {
  const rows = await queryNeon<any>`SELECT DISTINCT p.species_common_name FROM photos p WHERE p.gallery_slug = ${gallerySlug} AND p.species_common_name IS NOT NULL AND p.species_common_name != '' AND p.is_active = true ORDER BY p.species_common_name LIMIT ${limit}`;
  return rows.map((r: any) => r.species_common_name);
}

/**
 * Fetch photos by gallery slug WITH derivative URLs
 */
export async function getPhotosByGallery(gallerySlug: string, limit: number = 20, offset: number = 0): Promise<any[]> {
  return queryNeon<any>`
    SELECT 
      p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.location, p.width, p.height, p.camera_model, p.lat, p.lon,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.original_r2_key, gp.sort_order
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = ${gallerySlug} 
      AND p.is_active = true
      AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL AND p.thumb_url != '' AND p.thumb_url NOT LIKE '%scarlet-macaw-test%'
           OR p.small_url IS NOT NULL AND p.small_url != '' AND p.small_url NOT LIKE '%scarlet-macaw-test%'
           OR p.medium_url IS NOT NULL AND p.medium_url != '' AND p.medium_url NOT LIKE '%scarlet-macaw-test%')
    ORDER BY gp.sort_order, p.date_taken DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

/**
 * Fetch recent photos for homepage
 */
export async function getRecentPhotos(limit: number): Promise<any[]> {
  return queryNeon<any>`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.location, p.width, p.height, p.camera_model, p.lat, p.lon,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.original_r2_key
    FROM photos p
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.date_uploaded DESC
    LIMIT ${limit}
  `;
}

/**
 * Fetch photos batch for infinite scroll
 */
export async function getPhotosBatch(offset: number): Promise<any[]> {
  return queryNeon<any>`
    SELECT p.id, p.slug, p.title, p.small_url, g.slug AS gallery_slug, g.name AS gallery_name
    FROM photos p
    LEFT JOIN gallery_photos gp ON gp.photo_id = p.id
    LEFT JOIN galleries g ON g.id = gp.gallery_id
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND p.small_url IS NOT NULL
    ORDER BY p.date_uploaded DESC
    LIMIT 37
    OFFSET ${offset}
  `;
}

/**
 * Fetch random photos
 */
export async function getRandomPhotos(limit: number): Promise<any[]> {
  return queryNeon<any>`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.location, p.width, p.height, p.camera_model, p.lat, p.lon,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.original_r2_key
    FROM photos p
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;
}

/**
 * Fetch photo by slug
 */
export async function getPhotoBySlug(slug: string): Promise<any | null> {
  const rows = await queryNeon<any>`
    SELECT 
      p.id, p.slug, p.title, p.description, p.description_long,
      p.keywords, p.subjects, p.scene_type,
      p.species_common_name, p.species_scientific_name, p.species_confidence, p.animal_group,
      p.country, p.region, p.location_name,
      p.latitude, p.longitude, p.location_hint,
      p.date_taken, p.camera_make, p.camera_model, p.lens_model,
      p.iso, p.shutter_speed, p.aperture, p.focal_length_mm,
      p.width, p.height,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.r2_thumb_key, p.r2_web_small_key, p.r2_web_large_key, p.r2_print_key,
      p.original_r2_key,
      p.ready_for_public_render, p.search_ready, p.needs_review, p.views_count,
      p.gallery_slug, g.name as gallery_name
    FROM photos p
    LEFT JOIN galleries g ON p.gallery_id = g.id
    WHERE p.slug = ${slug} AND p.ready_for_public_render = true
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, slug: r.slug, title: r.title,
    description: r.description, description_long: r.description_long,
    keywords: Array.isArray(r.keywords) ? r.keywords.join(', ') : r.keywords,
    subjects: Array.isArray(r.subjects) ? r.subjects.join(', ') : r.subjects,
    scene_type: r.scene_type,
    species_common_name: r.species_common_name, species_scientific_name: r.species_scientific_name,
    species_confidence: r.species_confidence, animal_group: r.animal_group,
    country: r.country, region: r.region, location_name: r.location_name,
    latitude: r.latitude, longitude: r.longitude, location_hint: r.location_hint,
    date_taken: r.date_taken, camera_make: r.camera_make, camera_model: r.camera_model,
    lens_model: r.lens_model, iso: r.iso, shutter_speed: r.shutter_speed,
    aperture: r.aperture, focal_length_mm: r.focal_length_mm,
    width: r.width, height: r.height,
    thumb_r2_key: r.r2_thumb_key, small_r2_key: r.r2_web_small_key,
    medium_r2_key: r.r2_web_large_key, large_r2_key: r.r2_print_key,
    small_url: r.small_url, medium_url: r.medium_url, large_url: r.large_url,
    preview_r2_key: r.preview_url ? r.preview_url.replace(/^.*\/derivatives\//, '') : null,
    original_r2_key: r.original_r2_key,
    ready_for_public_render: r.ready_for_public_render, search_ready: r.search_ready,
    needs_review: r.needs_review, locationName: r.location_name, views_count: r.views_count,
    gallery_slug: r.gallery_slug, gallery_name: r.gallery_name,
  };
}

/**
 * Record a photo visit
 */
export async function recordPhotoVisit(photoId: number, slug: string, referrer?: string, userAgent?: string): Promise<void> {
  try {
    const sqlFn = neon(NEON_CONNECTION);
    await sqlFn`
      INSERT INTO photo_visits (photo_id, slug, referrer, user_agent, visited_at)
      VALUES (${photoId}, ${slug}, ${referrer || null}, ${userAgent || null}, NOW())
    `;
    await sqlFn`UPDATE photos SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ${photoId}`;
  } catch (error) {
    console.error('[db] Visit record error:', error);
  }
}

/**
 * Search photos
 */
export async function searchPhotos(query: string, limit: number): Promise<any[]> {
  const q = '%' + query.toLowerCase() + '%';
  return queryNeon<any>`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.location, p.width, p.height, p.camera_model, p.lat, p.lon,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.original_r2_key
    FROM photos p
    WHERE p.is_active = true 
      AND (
        LOWER(p.title) LIKE ${q}
        OR LOWER(p.description) LIKE ${q}
        OR LOWER(p.keywords) LIKE ${q}
      )
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL OR p.preview_url IS NOT NULL)
    ORDER BY p.date_uploaded DESC
    LIMIT ${limit}
  `;
}

/**
 * Get gallery for a specific photo
 */
export async function getGalleryForPhoto(photoSlug: string): Promise<any | null> {
  const rows = await queryNeon<any>`SELECT g.id, g.slug, g.name, g.description FROM galleries g JOIN gallery_photos gp ON g.id = gp.gallery_id JOIN photos p ON gp.photo_id = p.id WHERE p.slug = ${photoSlug} AND g.is_active = true LIMIT 1`;
  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * Get all photos for sitemap
 */
export async function getAllPhotos(limit: number = 1000): Promise<any[]> {
  return queryNeon<any>`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.lat, p.lon, p.location_name, p.width, p.height,
      p.camera_make, p.camera_model, p.lens, p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
      p.date_taken, p.date_uploaded, p.views_count,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.thumb_r2_key, p.small_r2_key, p.medium_r2_key, p.large_r2_key, p.preview_r2_key,
      p.original_r2_key, p.original_stored, p.ready_for_public_render,
      p.search_ready, p.derivatives_complete
    FROM photos p
    WHERE p.is_active = true AND p.ready_for_public_render = true
    ORDER BY p.date_uploaded DESC
    LIMIT ${limit}
  `;
}

/**
 * Get total photo count for a gallery
 */
export async function getGalleryPhotoCount(gallerySlug: string): Promise<number> {
  const rows = await queryNeon<any>`SELECT COUNT(*) as count FROM photos p JOIN gallery_photos gp ON p.id = gp.photo_id JOIN galleries g ON gp.gallery_id = g.id WHERE g.slug = ${gallerySlug} AND p.is_active = true AND p.ready_for_public_render = true AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL)`;
  return rows.length > 0 ? parseInt(rows[0].count) : 0;
}

/**
 * Get public photos for sitemap
 */
export async function getPublicPhotosForSitemap(limit: number = 5000): Promise<any[]> {
  const rows = await queryNeon<any>`
    SELECT p.slug, p.title, p.date_uploaded, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    WHERE p.is_active = true
      AND p.ready_for_public_render = true
      AND (p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.date_uploaded DESC
    LIMIT ${limit}
  `;
  return rows.map((r: any) => ({
    slug: r.slug, title: r.title,
    date_uploaded: r.date_uploaded ? new Date(r.date_uploaded).toISOString().split('T')[0] : '2026-01-01',
    small_url: r.small_url, medium_url: r.medium_url, large_url: r.large_url,
    gallery_name: null, location: r.location,
  }));
}

/**
 * Get photos by species common name
 */
export async function getPhotosBySpecies(speciesName: string, limit: number = 10): Promise<any[]> {
  return queryNeon<any>`SELECT id, slug, title, small_url, thumb_url, medium_url, large_url, r2_web_small_key, r2_thumb_key FROM photos WHERE species_common_name = ${speciesName} AND is_active = true AND ready_for_public_render = true ORDER BY id DESC LIMIT ${limit}`;
}

/**
 * Get list of species with photos
 */
export async function getSpeciesList(): Promise<string[]> {
  const rows = await queryNeon<any>`SELECT DISTINCT species_common_name FROM photos WHERE species_common_name IS NOT NULL AND species_common_name != '' AND is_active = true AND ready_for_public_render = true ORDER BY species_common_name`;
  return rows.map((r: any) => r.species_common_name);
}