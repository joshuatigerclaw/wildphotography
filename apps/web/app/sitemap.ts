/**
 * Sitemap for Wildphotography
 * Generates XML sitemap for SEO with proper filtering
 */

import { MetadataRoute } from 'next';
import { getAllPhotos, getGalleries, getAllArticles } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';

// Galleries with < 5 active photos — too thin to index, excluded from sitemap
const THIN_GALLERY_SLUGS = new Set([
  'new-uploads',
  'test-gallery',
  'rainforests',
  'costa-rica-videos',
  'playa-hermosa-jaco-garabito',
]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Homepage
  entries.push({
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  });

  // Static pages
  const staticPages = [
    { url: '/galleries', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/species', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/region', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/article', priority: 0.9, changeFrequency: 'daily' as const },
    { url: '/search', priority: 0.7, changeFrequency: 'weekly' as const },
  ];

  for (const page of staticPages) {
    entries.push({
      url: `${SITE_URL}${page.url}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  try {
    // Get galleries - only active ones
    const galleries = await getGalleries();

    for (const gallery of galleries) {
      // Skip thin galleries — too few photos to be useful for SEO
      if (THIN_GALLERY_SLUGS.has(gallery.slug)) continue;

      entries.push({
        url: `${SITE_URL}/gallery/${gallery.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      });
    }

    // Get published articles
    const articles = await getAllArticles();

    for (const article of articles) {
      const lastModified = article.updatedAt ? new Date(article.updatedAt) : new Date();
      entries.push({
        url: `${SITE_URL}/article/${article.slug}`,
        lastModified,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      });
    }

    // Get photos - already filtered to ready_for_public_render = true
    const photos = await getAllPhotos(20000);

    for (const photo of photos) {
      entries.push({
        url: `${SITE_URL}/photo/${photo.slug}`,
        lastModified: photo.date_uploaded ? new Date(photo.date_uploaded) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error('[sitemap] Error generating sitemap:', e);
  }

  return entries;
}
