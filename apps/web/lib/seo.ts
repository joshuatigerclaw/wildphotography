/**
 * SEO Components for Wildphotography
 * 
 * - JSON-LD ImageObject for photo pages
 * - Canonical URLs
 * - OpenGraph metadata
 * - Sitemap generation
 */

import type { Metadata } from 'next';

const SITE_URL = 'https://wildphotography.com';

/**
 * Generate JSON-LD for photo pages
 */
export function generatePhotoJsonLd(photo: {
  title: string;
  description?: string;
  imageUrl: string;
  dateTaken?: Date;
  location?: string;
  width?: number;
  height?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: photo.title,
    description: photo.description,
    image: {
      '@type': 'ImageObject',
      url: photo.imageUrl,
      width: photo.width,
      height: photo.height,
    },
    datePublished: photo.dateTaken?.toISOString(),
    contentLocation: photo.location,
    author: {
      '@type': 'Person',
      name: 'Joshua ten Brink',
    },
    license: 'https://wildphotography.com/license',
  };
}

/**
 * Generate OpenGraph metadata for photo
 */
export function generatePhotoMetadata(photo: {
  title: string;
  description?: string;
  imageUrl: string;
}): Metadata {
  return {
    title: `${photo.title} | Wildphotography`,
    description: photo.description,
    openGraph: {
      title: photo.title,
      description: photo.description,
      images: [
        {
          url: photo.imageUrl,
          width: 1200,
          height: 800,
          alt: photo.title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: photo.title,
      description: photo.description,
      image: photo.imageUrl,
    },
  };
}

/**
 * Generate canonical URL
 */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
