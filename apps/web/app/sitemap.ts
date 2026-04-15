/**
 * Sitemap for Wildphotography
 * Generates XML sitemap for SEO with proper filtering + timeout protection
 * Capped at 5,000 photos to avoid Vercel serverless timeout (CF worker handles higher volume)
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

export const revalidate = 3600; // ISR: regenerate at most once per hour

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
    // Get galleries — skip if slow (Vercel 10s limit)
    try {
      const galleries = await Promise.race([
        getGalleries(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GALLERIES_TIMEOUT')), 8000)
        ),
      ]);
      for (const gallery of galleries) {
        if (THIN_GALLERY_SLUGS.has(gallery.slug)) continue;
        entries.push({
          url: `${SITE_URL}/gallery/${gallery.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        });
      }
    } catch {
      // galleries failed — continue without them
      console.warn('[sitemap] galleries timeout/fetch failed, skipping');
    }

    // Get published articles — skip if slow
    try {
      const articles = await Promise.race([
        getAllArticles(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ARTICLES_TIMEOUT')), 6000)
        ),
      ]);
      for (const article of articles) {
        const lastModified = article.updatedAt ? new Date(article.updatedAt) : new Date();
        entries.push({
          url: `${SITE_URL}/article/${article.slug}`,
          lastModified,
          changeFrequency: 'monthly' as const,
          priority: 0.8,
        });
      }
    } catch {
      console.warn('[sitemap] articles timeout/fetch failed, skipping');
    }

    // Get top photos — capped at 5000 to avoid timeout (CF worker handles higher volume)
    try {
      const photos = await Promise.race([
        getAllPhotos(5000),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PHOTOS_TIMEOUT')), 10000)
        ),
      ]);
      for (const photo of photos) {
        entries.push({
          url: `${SITE_URL}/photo/${photo.slug}`,
          lastModified: photo.date_uploaded ? new Date(photo.date_uploaded) : new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        });
      }
    } catch {
      console.warn('[sitemap] photos timeout/fetch failed, skipping');
    }
  } catch (e) {
    console.error('[sitemap] Error generating sitemap:', e);
  }

  return entries;
}
