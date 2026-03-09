/**
 * Typesense client for Worker
 */

import type { Photo } from '../types';

// Typesense config
const TYPESENSE_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_KEY = 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE'; // Search key (read-only)

/**
 * Search photos in Typesense
 */
export async function searchPhotos(query: string, limit = 20): Promise<Photo[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const url = `https://${TYPESENSE_HOST}/collections/photos/documents/search?q=${encodeURIComponent(query)}&query_by=title,keywords,description,location&per_page=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'X-Typesense-Api-Key': TYPESENSE_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[search] Typesense error:', response.status);
      return [];
    }

    const data = await response.json();
    
    return data.hits?.map((hit: any) => ({
      id: hit.document.id,
      slug: hit.document.slug,
      title: hit.document.title || 'Untitled',
      description: hit.document.description,
      filename: hit.document.slug + '.jpg',
      locationName: hit.document.location,
    })) || [];
  } catch (error) {
    console.error('[search] Error:', error);
    return [];
  }
}
