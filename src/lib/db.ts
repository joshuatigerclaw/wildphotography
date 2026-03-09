/**
 * Neon database client for Worker
 * 
 * Fetches from the Next.js API endpoints (which connect to Neon)
 * 
 * IMPORTANT: No fallback/mock data in production
 * - If API returns empty, page shows empty state
 * - This ensures production never shows placeholder content
 */

import type { Photo, Gallery } from '../types';

// API base URL for data fetching
const API_BASE = 'https://wildphotography.com/api/public';

/**
 * Fetch from API
 * Returns null on any error - no fallback data
 */
async function fetchApi<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      console.error('[api] Error:', response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('[api] Fetch error:', error);
    return null;
  }
}

/**
 * Fetch all galleries
 * Returns empty array if no data - no fallback
 */
export async function getGalleries(): Promise<Gallery[]> {
  // For now, return known galleries from imported data
  // TODO: Add /api/public/galleries endpoint
  const knownGalleries = [
    'surfing-costa-rica',
    'rivers', 
    'volcan-poas',
    'turtles'
  ];
  
  const galleries: Gallery[] = [];
  for (const slug of knownGalleries) {
    const data = await fetchApi<any>(`/gallery/${slug}`);
    if (data) {
      galleries.push({
        id: galleries.length + 1,
        slug: data.slug,
        name: data.name,
        description: data.description,
      });
    }
  }
  
  return galleries;
}

/**
 * Fetch gallery by slug
 * Returns null if not found - no fallback
 */
export async function getGalleryBySlug(slug: string): Promise<Gallery | null> {
  const data = await fetchApi<any>(`/gallery/${slug}`);
  if (!data) return null;
  
  return {
    id: 1,
    slug: data.slug,
    name: data.name,
    description: data.description,
  };
}

/**
 * Fetch photos by gallery
 * Returns empty array if none - no fallback
 */
export async function getPhotosByGallery(gallerySlug: string): Promise<Photo[]> {
  const data = await fetchApi<any>(`/gallery/${gallerySlug}`);
  if (!data?.photos) return [];
  
  return data.photos.map((p: any) => ({
    id: 0,
    slug: p.slug,
    title: p.title || 'Untitled',
    description: p.description,
    filename: p.slug + '.jpg',
    locationName: p.location,
  }));
}

/**
 * Fetch recent photos for homepage
 * Returns empty array if none - no fallback
 */
export async function getRecentPhotos(limit = 8): Promise<Photo[]> {
  const data = await fetchApi<any>('/gallery/surfing-costa-rica');
  if (!data?.photos) return [];
  
  return data.photos.slice(0, limit).map((p: any) => ({
    id: 0,
    slug: p.slug,
    title: p.title || 'Untitled',
    description: p.description,
    filename: p.slug + '.jpg',
    locationName: p.location,
  }));
}

/**
 * Fetch photo by slug
 * Returns null if not found - no fallback
 */
export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  const data = await fetchApi<any>(`/photos/${slug}`);
  if (!data) return null;
  
  return {
    id: 0,
    slug: data.slug,
    title: data.title || 'Untitled',
    description: data.description,
    filename: data.slug + '.jpg',
    locationName: data.location,
  };
}
