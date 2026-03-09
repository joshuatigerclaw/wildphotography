/**
 * Sitemap for Wildphotography
 * 
 * Generates XML sitemap for SEO
 */

import { MetadataRoute } from 'next';
import { getAllPhotos, getGalleries } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  
  // Homepage
  entries.push({
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  });
  
  // Galleries page
  entries.push({
    url: `${SITE_URL}/galleries`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  
  // Search page
  entries.push({
    url: `${SITE_URL}/search`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  });
  
  try {
    // Get galleries
    const galleries = await getGalleries();
    
    for (const gallery of galleries) {
      entries.push({
        url: `${SITE_URL}/gallery/${gallery.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      });
    }
    
    // Get photos
    const photos = await getAllPhotos(500); // Limit for now
    
    for (const photo of photos) {
      entries.push({
        url: `${SITE_URL}/photo/${photo.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error('[sitemap] Error generating sitemap:', e);
  }
  
  return entries;
}
