/**
 * Database client for Neon
 * 
 * Uses direct SQL queries to avoid type conflicts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

const sql = neon(DATABASE_URL);

/**
 * Prepend R2 public URL to relative path
 */
function withR2Base(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

/**
 * Create URL-safe slug with proper Unicode normalization
 * Accented characters (e.g. ó, é, í) are normalized to base ASCII
 */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert snake_case DB metadata to camelCase LocationMeta
 */
function parseLocationMeta(raw: any): LocationMeta | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      overview: obj.overview,
      habitat: obj.habitat,
      seasons: obj.seasons,
      targetSpecies: obj.target_species || obj.targetSpecies,
      nearbyGalleries: obj.nearby_galleries || obj.nearbyGalleries,
      photographyTips: obj.photography_tips || obj.photographyTips,
      highlights: obj.highlights,
      bestSeason: obj.best_season || obj.bestSeason,
      galleryLinks: obj.gallery_links || obj.galleryLinks,
      speciesLinks: obj.species_links || obj.speciesLinks,
    };
  } catch {
    return null;
  }
}

export interface Photo {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  description_long?: string | null;
  keywords?: string | null;
  width?: number | null;
  height?: number | null;
  camera_make?: string | null;
  camera_model?: string | null;
  lens?: string | null;
  iso?: number | null;
  aperture?: string | null;
  shutter_speed?: string | null;
  focal_length_mm?: number | null;
  lat?: number | null;
  lon?: number | null;
  views_count?: number | null;
  date_taken?: string | null;
  date_uploaded?: string | null;
  // Full URLs with R2 base
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  locationName?: string | null;
  region?: string | null;
  country?: string | null;
  species_common_name?: string | null;
  species_scientific_name?: string | null;
}

export interface GallerySequence {
  previousPhoto: { id: string; slug: string; thumbUrl: string | null; title: string | null } | null;
  nextPhoto: { id: string; slug: string; thumbUrl: string | null; title: string | null } | null;
  position: number;
  total: number;
}

/**
 * Map DB row to Photo with R2 URLs
 */
function mapPhoto(row: any): Photo {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title || '',
    description: row.description,
    description_long: row.description_long,
    keywords: row.keywords,
    width: row.width,
    height: row.height,
    camera_make: row.camera_make,
    camera_model: row.camera_model,
    lens: row.lens,
    iso: row.iso,
    aperture: row.aperture,
    shutter_speed: row.shutter_speed,
    focal_length_mm: row.focal_length_mm,
    lat: row.lat,
    lon: row.lon,
    views_count: row.views_count,
    date_taken: row.date_taken,
    date_uploaded: row.date_uploaded,
    // Prepend R2 base to all URLs
    thumbUrl: withR2Base(row.thumb_url),
    smallUrl: withR2Base(row.small_url),
    mediumUrl: withR2Base(row.medium_url),
    largeUrl: withR2Base(row.large_url),
    locationName: row.location,
    region: row.region || null,
    country: row.country || null,
    species_common_name: row.species_common_name || null,
    species_scientific_name: row.species_scientific_name || null,
  };
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
      p.thumb_url as "coverPhotoUrlRaw",
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
    coverPhotoUrl: withR2Base(row.coverPhotoUrlRaw),
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
      p.thumb_url as "coverPhotoUrlRaw",
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
    coverPhotoUrl: withR2Base(row.coverPhotoUrlRaw),
    photoCount: Number(row.photoCount),
  };
}

/**
 * Get gallery for a specific photo
 */
export async function getGalleryForPhoto(photoSlug: string): Promise<Gallery | null> {
  const result = await sql(`
    SELECT g.id, g.slug, g.name, g.description
    FROM galleries g
    JOIN gallery_photos gp ON g.id = gp.gallery_id
    JOIN photos p ON gp.photo_id = p.id
    WHERE p.slug = $1 AND g.is_active = true
    LIMIT 1
  `, [photoSlug]);
  
  if (result.length === 0) return null;
  
  const row = result[0] as any;
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    coverPhotoUrl: null,
    photoCount: 0,
  };
}

/**
 * Get photos for a gallery
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
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = $1 AND p.is_active = true AND p.ready_for_public_render = true
    ORDER BY gp.sort_order, p.date_uploaded DESC
    LIMIT $2 OFFSET $3
  `, [gallerySlug, limit + 1, offset]);
  
  const hasMore = result.length > limit;
  const photos = (result as any[]).slice(0, limit).map(mapPhoto);
  
  return { photos, total, hasMore };
}

/**
 * Get photo by slug
 */
export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location,
           p.region, p.country, p.species_common_name, p.species_scientific_name
    FROM photos p
    WHERE p.slug = $1 AND p.is_active = true AND p.ready_for_public_render = true
    LIMIT 1
  `, [slug]);
  
  if (result.length === 0) return null;
  
  return mapPhoto(result[0]);
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
    await sql`
      INSERT INTO photo_visits (photo_id, slug, referrer, user_agent, visited_at)
      VALUES (${photoId}, ${slug}, ${referrer || null}, ${userAgent || null}, NOW())
    `;
    
    await sql`
      UPDATE photos SET views_count = COALESCE(views_count, 0) + 1
      WHERE id = ${photoId}
    `;
  } catch (error) {
    console.error('[db] Visit record error:', error);
  }
}

/**
 * Get all photos
 */
export async function getAllPhotos(limit = 20): Promise<Photo[]> {
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.date_uploaded DESC
    LIMIT $1
  `, [limit]);
  
  return (result as any[]).map(mapPhoto);
}

/**
 * Get random photos
 */
export async function getRandomPhotos(limit = 12): Promise<Photo[]> {
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY RANDOM()
    LIMIT $1
  `, [limit]);
  
  return (result as any[]).map(mapPhoto);
}

/**
 * Get popular photos
 */
export async function getPopularPhotos(limit = 12): Promise<Photo[]> {
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND p.views_count IS NOT NULL AND p.views_count > 0
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.views_count DESC
    LIMIT $1
  `, [limit]);
  
  return (result as any[]).map(mapPhoto);
}

/**
 * Get related photos
 */
export async function getRelatedPhotos(
  photoSlug: string, 
  gallerySlug?: string,
  keywords?: string,
  limit = 8
): Promise<Photo[]> {
  let galleryId = gallerySlug;
  
  if (!galleryId) {
    const galleryResult = await sql(`
      SELECT g.slug
      FROM galleries g
      JOIN gallery_photos gp ON g.id = gp.gallery_id
      JOIN photos p ON gp.photo_id = p.id
      WHERE p.slug = $1
      LIMIT 1
    `, [photoSlug]);
    
    if (galleryResult.length > 0) {
      galleryId = galleryResult[0].slug;
    }
  }
  
  let query = `
    SELECT DISTINCT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
  `;
  
  const params: any[] = [photoSlug];
  
  if (galleryId) {
    query += `
      JOIN gallery_photos gp ON p.id = gp.photo_id
      JOIN galleries g ON gp.gallery_id = g.id
      WHERE p.slug != $1 AND p.is_active = true AND p.ready_for_public_render = true
      AND g.slug = $${params.length + 1}
    `;
    params.push(galleryId);
  } else {
    query += `
      WHERE p.slug != $1 AND p.is_active = true AND p.ready_for_public_render = true
    `;
  }
  
  query += `
    AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.views_count DESC NULLS LAST, p.date_uploaded DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);
  
  const result = await sql(query, params);
  
  return (result as any[]).map(mapPhoto);
}

/**
 * Get photos from same gallery
 */
export async function getPhotosFromGallery(
  gallerySlug: string,
  excludePhotoSlug?: string,
  limit = 8
): Promise<Photo[]> {
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = $1 AND p.is_active = true AND p.ready_for_public_render = true
      ${excludePhotoSlug ? `AND p.slug != $2` : ''}
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY gp.sort_order, p.date_uploaded DESC
    LIMIT $${excludePhotoSlug ? 3 : 2}
  `, excludePhotoSlug ? [gallerySlug, excludePhotoSlug] : [gallerySlug, limit]);
  
  return (result as any[]).map(mapPhoto);
}

/**
 * Search photos
 */
export async function searchPhotos(
  query: string, 
  limit = 50, 
  offset = 0,
  gallerySlug?: string
): Promise<{ photos: Photo[]; total: number; hasMore: boolean }> {
  const safeQuery = query.toLowerCase();
  
  let whereClause = `
    WHERE p.is_active = true 
      AND p.ready_for_public_render = true
      AND (
        LOWER(p.title) LIKE '%' || $1 || '%'
        OR LOWER(p.description) LIKE '%' || $1 || '%'
        OR LOWER(p.keywords) LIKE '%' || $1 || '%'
        OR LOWER(p.location) LIKE '%' || $1 || '%'
      )
  `;
  
  const params: any[] = [safeQuery];
  
  if (gallerySlug) {
    whereClause += ` AND g.slug = $${params.length + 1}`;
    params.push(gallerySlug);
  }
  
  const countResult = await sql(`
    SELECT COUNT(*) as count
    FROM photos p
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    ${whereClause}
  `, params);
  
  const total = Number(countResult[0]?.count || 0);
  
  const result = await sql(`
    SELECT DISTINCT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    ${whereClause}
    ORDER BY p.date_uploaded DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit + 1, offset]);
  
  const hasMore = result.length > limit;
  const photos = (result as any[]).slice(0, limit).map(mapPhoto);
  
  return { photos, total, hasMore };
}

// ============================================================
// Species Queries
// ============================================================

export interface Species {
  name: string;
  scientificName: string | null;
  photoCount: number;
  sampleThumb: string | null;
  slug: string;
}

/**
 * Get all species with photos
 */
export async function getAllSpecies(): Promise<Species[]> {
  const result = await sql(`
    SELECT 
      species_common_name as name,
      species_scientific_name,
      COUNT(*) as photo_count,
      MAX(p.thumb_url) as sample_thumb
    FROM photos p
    WHERE species_common_name IS NOT NULL 
      AND species_common_name != ''
      AND is_active = true 
      AND ready_for_public_render = true
      AND thumb_url IS NOT NULL
    GROUP BY species_common_name, species_scientific_name
    HAVING COUNT(*) >= 1
    ORDER BY COUNT(*) DESC, species_common_name
  `);
  
  return (result as any[]).map(row => ({
    name: row.name,
    scientificName: row.species_scientific_name,
    photoCount: Number(row.photo_count),
    sampleThumb: withR2Base(row.sample_thumb),
    slug: slugify(row.name),
  }));
}

/**
 * Get photos by species name
 */
export async function getPhotosBySpecies(
  speciesName: string, 
  limit = 50, 
  offset = 0
): Promise<{ photos: Photo[]; total: number; hasMore: boolean }> {
  const countResult = await sql(`
    SELECT COUNT(*) as count
    FROM photos p
    WHERE species_common_name = $1 
      AND is_active = true 
      AND ready_for_public_render = true
  `, [speciesName]);
  
  const total = Number(countResult[0]?.count || 0);
  
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location,
           p.species_common_name, p.species_scientific_name
    FROM photos p
    WHERE species_common_name = $1 
      AND is_active = true 
      AND ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.date_uploaded DESC
    LIMIT $2 OFFSET $3
  `, [speciesName, limit + 1, offset]);
  
  const hasMore = result.length > limit;
  const photos = (result as any[]).slice(0, limit).map(mapPhoto);
  
  return { photos, total, hasMore };
}

// ============================================================
// Region Queries  
// ============================================================

export interface Region {
  name: string;
  photoCount: number;
  sampleThumb: string | null;
  slug: string;
}

export interface RegionEx extends Region {
  overview?: string;
  highlights?: string[];
  galleryLinks?: { name: string; slug: string }[];
  speciesLinks?: { name: string; slug: string }[];
  bestSeason?: string;
  photographyTips?: string;
}

export interface Location {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  locationType: string | null;
  description: string | null;
  metadata: LocationMeta | null;
}

export interface LocationMeta {
  overview?: string;
  habitat?: string;
  seasons?: string;
  targetSpecies?: string[];
  nearbyGalleries?: { name: string; slug: string }[];
  photographyTips?: string;
  highlights?: string[];
  bestSeason?: string;
  galleryLinks?: { name: string; slug: string }[];
  speciesLinks?: { name: string; slug: string }[];
}

/**
 * Get all regions with photos
 */
/**
 * Get photos by region
 */
export async function getPhotosByRegion(
  regionName: string, 
  limit = 50, 
  offset = 0
): Promise<{ photos: Photo[]; total: number; hasMore: boolean }> {
  const countResult = await sql(`
    SELECT COUNT(*) as count
    FROM photos p
    WHERE region = $1 
      AND is_active = true 
      AND ready_for_public_render = true
  `, [regionName]);
  
  const total = Number(countResult[0]?.count || 0);
  
  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    WHERE region = $1 
      AND is_active = true 
      AND ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.date_uploaded DESC
    LIMIT $2 OFFSET $3
  `, [regionName, limit + 1, offset]);
  
  const hasMore = result.length > limit;
  const photos = (result as any[]).slice(0, limit).map(mapPhoto);
  
  return { photos, total, hasMore };
}

// ============================================================
// Location Queries
// ============================================================

function mapLocation(row: any): Location {
  const metadata = parseLocationMeta(row.metadata);
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    country: row.country,
    region: row.region,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    locationType: row.location_type,
    description: row.description,
    metadata,
  };
}

/**
 * Get all locations
 */
export async function getAllLocations(): Promise<Location[]> {
  const result = await sql(`
    SELECT id, name, slug, country, region, latitude, longitude, location_type, description, metadata
    FROM locations
    ORDER BY location_type, name
  `);
  return (result as any[]).map(mapLocation);
}

/**
 * Get location by slug
 */
export async function getLocationBySlug(slug: string): Promise<Location | null> {
  const result = await sql(`
    SELECT id, name, slug, country, region, latitude, longitude, location_type, description, metadata
    FROM locations
    WHERE slug = $1
  `, [slug]);
  if (result.length === 0) return null;
  return mapLocation(result[0]);
}

/**
 * Get all regions enriched with locations table metadata
 */
export async function getAllRegions(): Promise<RegionEx[]> {
  // First get photo counts
  const photoResult = await sql(`
    SELECT 
      region,
      COUNT(*) as photo_count,
      MAX(p.thumb_url) as sample_thumb
    FROM photos p
    WHERE region IS NOT NULL 
      AND region != ''
      AND is_active = true 
      AND ready_for_public_render = true
      AND thumb_url IS NOT NULL
    GROUP BY region
    HAVING COUNT(*) >= 5
    ORDER BY COUNT(*) DESC, region
  `);

  // Get location metadata for regions
  const locResult = await sql(`
    SELECT name, slug, region, latitude, longitude, location_type, description, metadata
    FROM locations
    WHERE location_type = 'region'
    ORDER BY name
  `);

  const locMap = new Map<string, any>();
  for (const row of locResult as any[]) {
    locMap.set(row.name, row);
  }

  return (photoResult as any[]).map(row => {
    const loc = locMap.get(row.region);
    const meta = parseLocationMeta(loc?.metadata);
    return {
      name: row.region,
      photoCount: Number(row.photo_count),
      sampleThumb: withR2Base(row.sample_thumb),
      slug: loc?.slug || slugify(row.region),
      overview: meta?.overview,
      highlights: meta?.highlights || [],
      galleryLinks: meta?.galleryLinks || [],
      speciesLinks: meta?.speciesLinks || [],
      bestSeason: meta?.bestSeason,
      photographyTips: meta?.photographyTips,
    };
  });
}

/**
 * Get region data enriched with locations table metadata
 */
export async function getRegionBySlug(slug: string): Promise<RegionEx | null> {
  // The slug is generated via slugify, which strips accents
  // So we need to map slug back to region name
  const regions = await getAllRegions();
  return regions.find(r => r.slug === slug) || null;
}

/**
 * Get locations by region name
 */
export async function getLocationsByRegion(regionName: string): Promise<Location[]> {
  const result = await sql(`
    SELECT id, name, slug, country, region, latitude, longitude, location_type, description, metadata
    FROM locations
    WHERE region = $1 AND location_type = 'location'
    ORDER BY name
  `, [regionName]);
  return (result as any[]).map(mapLocation);
}

/**
 * Get photos by location slug
 */
export async function getPhotosByLocation(
  locationSlug: string,
  limit = 50,
  offset = 0
): Promise<{ photos: Photo[]; total: number; hasMore: boolean }> {
  const loc = await getLocationBySlug(locationSlug);
  if (!loc) return { photos: [], total: 0, hasMore: false };

  // Match by gallery slug for locations
  const meta = parseLocationMeta(loc.metadata);
  const gallerySlugs: string[] = [];
  
  if (meta?.nearbyGalleries) {
    gallerySlugs.push(...meta.nearbyGalleries.map((g: any) => g.slug));
  }
  
  if (gallerySlugs.length === 0) {
    return { photos: [], total: 0, hasMore: false };
  }

  const placeholders = gallerySlugs.map((_, i) => `$${i + 2}`).join(',');
  
  const countResult = await sql(`
    SELECT COUNT(*) as count
    FROM photos p
    WHERE p.gallery_slug IN (${placeholders})
      AND p.is_active = true AND p.ready_for_public_render = true
  `, gallerySlugs);

  const total = Number(countResult[0]?.count || 0);

  const result = await sql(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location
    FROM photos p
    WHERE p.gallery_slug IN (${placeholders})
      AND p.is_active = true AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)
    ORDER BY p.date_uploaded DESC
    LIMIT $${gallerySlugs.length + 2} OFFSET $${gallerySlugs.length + 3}
  `, [...gallerySlugs, limit + 1, offset]);

  const hasMore = result.length > limit;
  const photos = (result as any[]).slice(0, limit).map(mapPhoto);

  return { photos, total, hasMore };
}

// ============================================================
// Article Queries
// ============================================================

export interface Article {
  id: string;
  title: string;
  slug: string;
  articleType: string;
  excerpt: string | null;
  content: string | null;
  status: string;
  author: string | null;
  featuredPhotoId: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  photoSlug: string | null;
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
}

function mapArticle(row: any): Article {
  return {
    id: String(row.id),
    title: row.title || '',
    slug: row.slug || '',
    articleType: row.article_type || '',
    excerpt: row.excerpt || null,
    content: row.content || null,
    status: row.status || '',
    author: row.author || null,
    featuredPhotoId: row.featured_photo_id || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    publishedAt: row.published_at || null,
    photoSlug: row.photo_slug || null,
    thumbUrl: withR2Base(row.thumb_url),
    smallUrl: withR2Base(row.small_url),
    mediumUrl: withR2Base(row.medium_url),
    largeUrl: withR2Base(row.large_url),
  };
}

/**
 * Get all published articles
 */
export async function getAllArticles(): Promise<Article[]> {
  const result = await sql(`
    SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt, ca.content,
           ca.status, ca.author, ca.featured_photo_id,
           ca.created_at, ca.updated_at, ca.published_at,
           p.slug as photo_slug, p.thumb_url, p.small_url, p.medium_url, p.large_url
    FROM content_articles ca
    LEFT JOIN photos p ON p.id = ca.featured_photo_id
    WHERE ca.status = 'published'
    ORDER BY ca.published_at DESC NULLS LAST, ca.updated_at DESC
  `);
  return (result as any[]).map(mapArticle);
}

/**
 * Get published article by slug
 */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const result = await sql(`
    SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt, ca.content,
           ca.status, ca.author, ca.featured_photo_id,
           ca.created_at, ca.updated_at, ca.published_at,
           p.slug as photo_slug, p.thumb_url, p.small_url, p.medium_url, p.large_url
    FROM content_articles ca
    LEFT JOIN photos p ON p.id = ca.featured_photo_id
    WHERE ca.slug = $1 AND ca.status = 'published'
    LIMIT 1
  `, [slug]);
  if (result.length === 0) return null;
  return mapArticle(result[0]);
}

/**
 * Get related articles (same type or shared keywords) excluding current
 */
export async function getRelatedArticles(currentSlug: string, articleType?: string, limit = 3): Promise<Article[]> {
  let query = `
    SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt, ca.content,
           ca.status, ca.author, ca.featured_photo_id,
           ca.created_at, ca.updated_at, ca.published_at,
           p.slug as photo_slug, p.thumb_url, p.small_url, p.medium_url, p.large_url
    FROM content_articles ca
    LEFT JOIN photos p ON p.id = ca.featured_photo_id
    WHERE ca.status = 'published' AND ca.slug != $1
  `;
  const params: any[] = [currentSlug];

  if (articleType) {
    query += ` AND ca.article_type = $2`;
    params.push(articleType);
  }

  query += ` ORDER BY ca.published_at DESC NULLS LAST LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await sql(query, params);
  return (result as any[]).map(mapArticle);
}

/**
 * Get previous / next photos in the same gallery sequence for a given photo.
 * Navigation stays strictly within the same gallery.
 * Order priority: gallery_photos.sort_order → photos.date_uploaded → photos.id
 */
export async function getGallerySequenceForPhoto(
  photoSlug: string,
  galleryId: string
): Promise<GallerySequence> {
  // Fetch full ordered sequence for this gallery (only active, public-ready photos)
  const sequence = await sql(`
    SELECT p.id, p.slug, p.title,
           p.thumb_url, p.small_url,
           gp.sort_order
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    WHERE gp.gallery_id = $1
      AND p.is_active = true
      AND p.ready_for_public_render = true
      AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL)
    ORDER BY gp.sort_order ASC NULLS LAST, p.date_uploaded ASC, p.id ASC
  `, [galleryId]);

  const rows = sequence as any[];
  const total = rows.length;

  // Find current photo position (0-indexed)
  const currentIndex = rows.findIndex(r => r.slug === photoSlug);

  if (currentIndex === -1) {
    return { previousPhoto: null, nextPhoto: null, position: 0, total };
  }

  const mapSeqPhoto = (row: any) => ({
    id: String(row.id),
    slug: row.slug,
    title: row.title || null,
    thumbUrl: withR2Base(row.thumb_url) || withR2Base(row.small_url),
  });

  const previousPhoto = currentIndex > 0 ? mapSeqPhoto(rows[currentIndex - 1]) : null;
  const nextPhoto = currentIndex < total - 1 ? mapSeqPhoto(rows[currentIndex + 1]) : null;

  return {
    previousPhoto,
    nextPhoto,
    position: currentIndex + 1, // 1-indexed for display
    total,
  };
}

export default {
  getGalleries,
  getGalleryBySlug,
  getGalleryForPhoto,
  getPhotosByGallery,
  getPhotoBySlug,
  getAllPhotos,
  getRandomPhotos,
  getPopularPhotos,
  getRelatedPhotos,
  getPhotosFromGallery,
  getGallerySequenceForPhoto,
  searchPhotos,
  recordPhotoVisit,
  getAllSpecies,
  getPhotosBySpecies,
  getAllRegions,
  getPhotosByRegion,
  getRegionBySlug,
  getAllLocations,
  getLocationBySlug,
  getLocationsByRegion,
  getPhotosByLocation,
  getAllArticles,
  getArticleBySlug,
  getRelatedArticles,
};
