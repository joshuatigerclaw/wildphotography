/**
 * Neon database client for Worker
 * 
 * Fetches from the Next.js API endpoints (which connect to Neon)
 */

import type { Photo, Gallery } from '../types';

// Use the API proxy to get data
const API_BASE = 'https://wildphotography.com/api/public';

/**
 * Fetch from API
 */
async function fetchApi<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[api] Error:', error);
    return null;
  }
}

/**
 * Fetch all galleries
 */
export async function getGalleries(): Promise<Gallery[]> {
  // Try the galleries API
  const data = await fetchApi<any>('/gallery/surfing-costa-rica');
  if (data) {
    // Return the single gallery for now
    return [{
      id: 1,
      slug: data.slug,
      name: data.name,
      description: data.description,
    }];
  }
  
  // Fallback to static list
  return [
    { id: 1, slug: 'surfing-costa-rica', name: 'Surfing Costa Rica', description: 'Wave riding in Costa Rica' },
    { id: 2, slug: 'rivers', name: 'Rivers', description: 'Costa Rica rivers' },
    { id: 3, slug: 'volcan-poas', name: 'Volcan Poas', description: 'Volcan Poas volcano' },
    { id: 4, slug: 'turtles', name: 'Turtles', description: 'Sea turtles' },
  ];
}

/**
 * Fetch gallery by slug
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
 */
export async function getPhotosByGallery(gallerySlug: string): Promise<Photo[]> {
  const data = await fetchApi<any>(`/gallery/${gallerySlug}`);
  if (!data?.photos) return [];
  
  return data.photos.map((p: any) => ({
    id: 0,
    slug: p.slug,
    title: p.title,
    description: p.description,
    filename: p.slug + '.jpg', // Use slug as filename
    locationName: p.location,
  }));
}

/**
 * Fetch recent photos for homepage
 */
export async function getRecentPhotos(limit = 8): Promise<Photo[]> {
  // Fetch from a gallery for featured photos
  const data = await fetchApi<any>('/gallery/surfing-costa-rica');
  if (!data?.photos) {
    return getMockPhotos(limit);
  }
  
  return data.photos.slice(0, limit).map((p: any) => ({
    id: 0,
    slug: p.slug,
    title: p.title,
    description: p.description,
    filename: p.slug + '.jpg',
    locationName: p.location,
  }));
}

/**
 * Fetch photo by slug
 */
export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  const data = await fetchApi<any>(`/photos/${slug}`);
  if (!data) return null;
  
  return {
    id: 0,
    slug: data.slug,
    title: data.title,
    description: data.description,
    filename: data.slug + '.jpg',
    locationName: data.location,
  };
}

// Mock fallback
function getMockPhotos(count: number): Photo[] {
  return Array(count).fill(null).map((_, i) => ({
    id: i,
    slug: 'scarlet-macaw-test',
    title: 'Scarlet Macaw',
    description: 'Costa Rica\'s most iconic bird',
    filename: 'scarlet-macaw-test.jpg',
    locationName: 'Costa Rica'
  }));
}
