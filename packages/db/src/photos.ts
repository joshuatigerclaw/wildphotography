import { db } from '@wildphotography/db';
import { photos, galleries, galleryPhotos, keywords, photoKeywords } from '@wildphotography/db/schema';
import { eq, desc, sql, like, or, and } from 'drizzle-orm';

// ============================================================
// Types
// ============================================================

export interface PhotoRow {
  id: number;
  slug: string;
  title: string | null;
  description: string | null;
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  locationName: string | null;
  keywords: string[];
  width: number | null;
  height: number | null;
}

export interface GalleryRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  coverPhotoUrl: string | null;
  photoCount: number;
}

export interface PaginatedPhotos {
  photos: PhotoRow[];
  total: number;
  hasMore: boolean;
}

// ============================================================
// Photo Queries
// ============================================================

const SELECT_PHOTO_FIELDS = {
  id: photos.id,
  slug: sql<string>`replace(lower(${photos.filename}), ' ', '-')`.as('slug'),
  title: photos.title,
  description: photos.description,
  // Use thumbnailUrl if available, otherwise construct from imageUrl
  thumbUrl: sql<string>`COALESCE(${photos.thumbnailUrl}, ${photos.imageUrl})`.as('thumbUrl'),
  smallUrl: photos.imageUrl.as('smallUrl'),
  mediumUrl: sql<string>`${photos.imageUrl}`.as('mediumUrl'),
  largeUrl: photos.imageUrl.as('largeUrl'),
  locationName: photos.location,
  width: photos.width,
  height: photos.height,
};

// Build photo row with keywords
async function buildPhotoRow(row: any): Promise<PhotoRow> {
  // Fetch keywords for this photo
  const keywordRows = await db
    .select({ name: keywords.name })
    .from(photoKeywords)
    .innerJoin(keywords, eq(photoKeywords.keywordId, keywords.id))
    .where(eq(photoKeywords.photoId, row.id))
    .limit(5);

  return {
    id: String(row.id),
    slug: row.slug || `photo-${row.id}`,
    title: row.title || 'Untitled',
    description: row.description,
    thumbUrl: row.thumbUrl,
    smallUrl: row.smallUrl,
    mediumUrl: row.mediumUrl,
    largeUrl: row.largeUrl,
    locationName: row.locationName,
    keywords: keywordRows.map(k => k.name),
    width: row.width,
    height: row.height,
  };
}

/**
 * Get paginated photos from the database
 */
export async function getPhotos({
  limit = 50,
  offset = 0,
  gallerySlug,
  search,
}: {
  limit?: number;
  offset?: number;
  gallerySlug?: string;
  search?: string;
}): Promise<PaginatedPhotos> {
  let conditions = [eq(photos.isActive, true)];

  // Filter by gallery if provided
  if (gallerySlug) {
    const gallery = await db
      .select()
      .from(galleries)
      .where(eq(galleries.slug, gallerySlug))
      .limit(1);

    if (gallery.length > 0) {
      const photoIds = await db
        .select({ photoId: galleryPhotos.photoId })
        .from(galleryPhotos)
        .where(eq(galleryPhotos.galleryId, gallery[0].id));

      if (photoIds.length > 0) {
        conditions.push(sql`${photos.id} IN (${photoIds.map(p => p.photoId).join(',')})`);
      }
    }
  }

  // Search filter
  if (search) {
    conditions.push(
      or(
        like(photos.title, `%${search}%`),
        like(photos.description, `%${search}%`),
        like(photos.location, `%${search}%`)
      )
    );
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(photos)
    .where(and(...conditions));

  const total = Number(countResult[0]?.count || 0);

  // Get photos
  const photoRows = await db
    .select(SELECT_PHOTO_FIELDS)
    .from(photos)
    .where(and(...conditions))
    .orderBy(desc(photos.dateUploaded))
    .limit(limit + 1) // Fetch one extra to check hasMore
    .offset(offset);

  const hasMore = photoRows.length > limit;
  const photosData = photoRows.slice(0, limit).map(buildPhotoRow);

  return {
    photos: await Promise.all(photosData),
    total,
    hasMore,
  };
}

/**
 * Get a single photo by slug or ID
 */
export async function getPhotoBySlug(slug: string): Promise<PhotoRow | null> {
  // Try to find by ID first
  const id = parseInt(slug, 10);
  
  let photoRows;
  if (!isNaN(id)) {
    photoRows = await db
      .select(SELECT_PHOTO_FIELDS)
      .from(photos)
      .where(eq(photos.id, id))
      .limit(1);
  } else {
    // Search by filename-based slug
    const filenamePattern = slug.replace(/-/g, ' ');
    photoRows = await db
      .select(SELECT_PHOTO_FIELDS)
      .from(photos)
      .where(
        or(
          like(photos.filename, `%${filenamePattern}%`),
          like(photos.title, `%${slug}%`)
        )
      )
      .limit(1);
  }

  if (photoRows.length === 0) return null;
  return buildPhotoRow(photoRows[0]);
}

// ============================================================
// Gallery Queries
// ============================================================

/**
 * Get all active galleries
 */
export async function getGalleries(): Promise<GalleryRow[]> {
  const galleryRows = await db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      name: galleries.name,
      description: galleries.description,
    })
    .from(galleries)
    .where(eq(galleries.isActive, true))
    .orderBy(galleries.sortOrder);

  // Get photo count and cover for each gallery
  const results: GalleryRow[] = await Promise.all(
    galleryRows.map(async (gallery) => {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(galleryPhotos)
        .where(eq(galleryPhotos.galleryId, gallery.id));

      const coverPhoto = await db
        .select({ thumbnailUrl: photos.thumbnailUrl })
        .from(galleryPhotos)
        .innerJoin(photos, eq(galleryPhotos.photoId, photos.id))
        .where(eq(galleryPhotos.galleryId, gallery.id))
        .orderBy(galleryPhotos.sortOrder)
        .limit(1);

      return {
        ...gallery,
        coverPhotoUrl: coverPhoto[0]?.thumbnailUrl || null,
        photoCount: Number(countResult[0]?.count || 0),
      };
    })
  );

  return results;
}

/**
 * Get gallery by slug
 */
export async function getGalleryBySlug(slug: string): Promise<GalleryRow | null> {
  const galleryRows = await db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      name: galleries.name,
      description: galleries.description,
    })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.isActive, true)))
    .limit(1);

  if (galleryRows.length === 0) return null;

  const gallery = galleryRows[0];
  
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(galleryPhotos)
    .where(eq(galleryPhotos.galleryId, gallery.id));

  const coverPhoto = await db
    .select({ thumbnailUrl: photos.thumbnailUrl })
    .from(galleryPhotos)
    .innerJoin(photos, eq(galleryPhotos.photoId, photos.id))
    .where(eq(galleryPhotos.galleryId, gallery.id))
    .orderBy(galleryPhotos.sortOrder)
    .limit(1);

  return {
    ...gallery,
    coverPhotoUrl: coverPhoto[0]?.thumbnailUrl || null,
    photoCount: Number(countResult[0]?.count || 0),
  };
}

// ============================================================
// Search
// ============================================================

/**
 * Search photos by query
 */
export async function searchPhotos({
  query,
  limit = 50,
  offset = 0,
}: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedPhotos> {
  return getPhotos({
    limit,
    offset,
    search: query,
  });
}
