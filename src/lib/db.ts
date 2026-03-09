/**
 * Neon database client for Worker
 * 
 * Uses @neondatabase/serverless for HTTP connection
 */

import type { Photo, Gallery } from '../types';

// Neon HTTP connection
// Note: We'll try to use a direct HTTP approach that works in Workers

// Mock data for now - can be replaced with real DB calls
const MOCK_GALLERIES: Gallery[] = [
  { id: 1, slug: 'surfing-costa-rica', name: 'Surfing Costa Rica', description: 'Wave riding in Costa Rica' },
  { id: 2, slug: 'rivers', name: 'Rivers', description: 'Costa Rica rivers' },
  { id: 3, slug: 'volcan-poas', name: 'Volcan Poas', description: 'Volcan Poas volcano' },
  { id: 4, slug: 'turtles', name: 'Turtles', description: 'Sea turtles' },
  { id: 5, slug: 'birds-of-costa-rica', name: 'Birds of Costa Rica', description: 'Avian diversity' },
];

const MOCK_PHOTOS: Photo[] = [
  { id: 1, slug: 'scarlet-macaw-test', title: 'Scarlet Macaw', description: 'Costa Rica\'s most iconic bird', filename: 'scarlet-macaw-test.jpg', locationName: 'Costa Rica' },
];

// Flag to use real database
const USE_REAL_DB = false;

/**
 * Fetch all galleries from Neon
 */
export async function getGalleries(): Promise<Gallery[]> {
  if (USE_REAL_DB) {
    try {
      // TODO: Implement with @neondatabase/serverless
      // const { rows } = await sql`SELECT * FROM galleries ORDER BY name`;
      // return rows;
    } catch (e) {
      console.error('[db] Neon error:', e);
    }
  }
  return MOCK_GALLERIES;
}

/**
 * Fetch gallery by slug
 */
export async function getGalleryBySlug(slug: string): Promise<Gallery | null> {
  const galleries = await getGalleries();
  return galleries.find(g => g.slug === slug) || null;
}

/**
 * Fetch recent photos for homepage
 */
export async function getRecentPhotos(limit = 8): Promise<Photo[]> {
  if (USE_REAL_DB) {
    try {
      // TODO: Implement
    } catch (e) {
      console.error('[db] Neon error:', e);
    }
  }
  return MOCK_PHOTOS.slice(0, limit);
}

/**
 * Fetch photos by gallery
 */
export async function getPhotosByGallery(gallerySlug: string): Promise<Photo[]> {
  if (USE_REAL_DB) {
    try {
      // TODO: Implement
    } catch (e) {
      console.error('[db] Neon error:', e);
    }
  }
  return MOCK_PHOTOS;
}

/**
 * Fetch photo by slug
 */
export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  if (USE_REAL_DB) {
    try {
      // TODO: Implement
    } catch (e) {
      console.error('[db] Neon error:', e);
    }
  }
  return MOCK_PHOTOS.find(p => p.slug === slug) || null;
}
