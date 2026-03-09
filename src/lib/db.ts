/**
 * Neon database client for Worker
 * 
 * Uses direct Neon HTTP queries
 */

import type { Photo, Gallery } from '../types';

// Neon HTTP query endpoint
const NEON_PROJECT = 'ep-calm-fire-ad0dfnqd';

// Media base URL
const MEDIA_BASE = 'https://wildphotography-media.josh-ec6.workers.dev';

/**
 * Execute SQL query via Neon's HTTP API
 */
export async function queryNeon<T>(sql: string, neonToken: string): Promise<T[]> {
  if (!neonToken) {
    console.error('[db] No Neon token');
    return [];
  }

  try {
    const response = await fetch(
      `https://${NEON_PROJECT}.aws.neon.tech/v2/query?project=${NEON_PROJECT}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${neonToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          queries: [{ query: sql }],
        }),
      }
    );

    if (!response.ok) {
      console.error('[db] Neon error:', response.status);
      return [];
    }

    const data = await response.json();
    return data?.results?.[0]?.rows || [];
  } catch (error) {
    console.error('[db] Query error:', error);
    return [];
  }
}

/**
 * Fetch all galleries
 */
export async function getGalleries(neonToken: string): Promise<Gallery[]> {
  const knownGalleries = [
    'surfing-costa-rica',
    'rivers', 
    'volcan-poas',
    'turtles'
  ];
  
  const galleries: Gallery[] = [];
  for (const slug of knownGalleries) {
    const data = await getGalleryBySlug(slug, neonToken);
    if (data) galleries.push(data);
  }
  
  return galleries;
}

/**
 * Fetch gallery by slug with photos
 */
export async function getGalleryBySlug(slug: string, neonToken: string): Promise<Gallery | null> {
  const rows = await queryNeon<any>(`
    SELECT DISTINCT g.id, g.slug, g.name, g.description
    FROM galleries g
    JOIN gallery_photos gp ON g.id = gp.gallery_id
    JOIN photos p ON gp.photo_id = p.id
    WHERE g.slug = '${slug.replace(/'/g, "''")}'
    LIMIT 1
  `, neonToken);
  
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
 * Fetch photos by gallery slug
 */
export async function getPhotosByGallery(gallerySlug: string, neonToken: string): Promise<Photo[]> {
  // Try direct query
  const rows = await queryNeon<any>(`
    SELECT p.id, p.slug, p.title, p.description, p.thumb_url, p.small_url, p.location
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = '${gallerySlug.replace(/'/g, "''")}' AND p.is_active = true
    ORDER BY gp.sort_order, p.date_taken DESC
    LIMIT 20
  `, neonToken);
  
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title || 'Untitled',
    description: r.description,
    filename: r.thumb_url ? r.thumb_url.split('/').pop() : r.slug + '.jpg',
    locationName: r.location,
  }));
}

/**
 * Fetch recent photos for homepage
 */
export async function getRecentPhotos(limit: number, neonToken: string): Promise<Photo[]> {
  const rows = await queryNeon<any>(`
    SELECT p.id, p.slug, p.title, p.description, p.thumb_url, p.small_url, p.location
    FROM photos p
    WHERE p.is_active = true AND p.thumb_url IS NOT NULL
    ORDER BY p.date_taken DESC
    LIMIT ${limit}
  `, neonToken);
  
  return rows.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title || 'Untitled',
    description: r.description,
    filename: r.thumb_url ? r.thumb_url.split('/').pop() : r.slug + '.jpg',
    locationName: r.location,
  }));
}

/**
 * Fetch photo by slug
 */
export async function getPhotoBySlug(slug: string, neonToken: string): Promise<Photo | null> {
  const rows = await queryNeon<any>(`
    SELECT p.id, p.slug, p.title, p.description, p.thumb_url, p.large_url, p.location
    FROM photos p
    WHERE p.slug = '${slug.replace(/'/g, "''")}' AND p.is_active = true
    LIMIT 1
  `, neonToken);
  
  if (rows.length === 0) return null;
  
  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    title: r.title || 'Untitled',
    description: r.description,
    filename: r.thumb_url ? r.thumb_url.split('/').pop() : r.slug + '.jpg',
    locationName: r.location,
  };
}
