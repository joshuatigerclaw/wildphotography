/**
 * SEO Components for Wildphotography
 *
 * - JSON-LD ImageObject for photo pages (richer Schema.org)
 * - JSON-LD BreadcrumbList for all content pages
 * - JSON-LD ItemList for gallery/collection pages
 * - JSON-LD Article for blog/editorial pages
 * - JSON-LD WebPage for generic pages
 * - JSON-LD CollectionPage for gallery index pages
 * - Canonical URLs
 * - OpenGraph metadata helpers
 * - Sitemap generation helpers
 */

const SITE_URL = 'https://wildphotography.com';
const SITE_NAME = 'WildPhotography';
const PHOTOGRAPHER_NAME = 'Joshua ten Brink';

/**
 * Generate canonical URL
 */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * Generate JSON-LD for photo pages — richer ImageObject schema
 */
export function generatePhotoJsonLd(photo: {
  title: string;
  description?: string;
  imageUrl: string;
  thumbUrl?: string;
  dateTaken?: Date;
  location?: string;
  region?: string;
  country?: string;
  width?: number;
  height?: number;
  slug: string;
  photographerName?: string;
}) {
  const author = photo.photographerName || PHOTOGRAPHER_NAME;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: photo.title,
    description: photo.description || undefined,
    image: {
      '@type': 'ImageObject',
      url: photo.imageUrl,
      width: photo.width || undefined,
      height: photo.height || undefined,
    },
    contentUrl: photo.imageUrl,
    thumbnailUrl: photo.thumbUrl || photo.imageUrl,
    url: `${SITE_URL}/photo/${photo.slug}`,
    datePublished: photo.dateTaken ? photo.dateTaken.toISOString().split('T')[0] : undefined,
    author: {
      '@type': 'Person',
      name: author,
      url: SITE_URL,
    },
    copyrightNotice: `© ${new Date().getFullYear()} ${author}. All rights reserved.`,
    creditText: `Photo by ${author} / ${SITE_NAME}`,
    license: 'https://wildphotography.com/license',
    acquireLicensePage: `${SITE_URL}/license`,
    creator: {
      '@type': 'Person',
      name: author,
      url: SITE_URL,
    },
    representativeOfPage: true,
  };

  // Add location if reliable
  if (photo.location || photo.region || photo.country) {
    schema.contentLocation = {
      '@type': 'Place',
      name: [photo.location, photo.region, photo.country].filter(Boolean).join(', '),
    };
  }

  return schema;
}

/**
 * Generate JSON-LD BreadcrumbList for any page
 *
 * @param crumbs Array of {name, url} from Home outward
 */
export function generateBreadcrumbJsonLd(crumbs: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url.startsWith('http') ? crumb.url : `${SITE_URL}${crumb.url}`,
    })),
  };
}

/**
 * Generate JSON-LD Article schema for editorial content
 */
export function generateArticleJsonLd(article: {
  title: string;
  description?: string;
  url: string;
  authorName?: string;
  publishedDate?: Date;
  modifiedDate?: Date;
  imageUrl?: string;
  publisherName?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description || undefined,
    url: article.url,
    datePublished: article.publishedDate ? article.publishedDate.toISOString().split('T')[0] : undefined,
    dateModified: article.modifiedDate ? article.modifiedDate.toISOString().split('T')[0] : undefined,
    author: {
      '@type': 'Person',
      name: article.authorName || PHOTOGRAPHER_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: article.publisherName || SITE_NAME,
      url: SITE_URL,
    },
    image: article.imageUrl
      ? {
          '@type': 'ImageObject',
          url: article.imageUrl,
        }
      : undefined,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
  };
}

/**
 * Generate JSON-LD CollectionPage for gallery index / listing pages
 */
export function generateCollectionPageJsonLd(opts: {
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  itemCount?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.title,
    description: opts.description || undefined,
    url: opts.url,
    image: opts.imageUrl
      ? {
          '@type': 'ImageObject',
          url: opts.imageUrl,
        }
      : undefined,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.itemCount || undefined,
      itemListElement: [],
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * Generate JSON-LD WebPage schema for generic pages
 */
export function generateWebPageJsonLd(opts: {
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  pageType?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': opts.pageType || 'WebPage',
    name: opts.title,
    description: opts.description || undefined,
    url: opts.url,
    image: opts.imageUrl
      ? {
          '@type': 'ImageObject',
          url: opts.imageUrl,
        }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    author: {
      '@type': 'Person',
      name: PHOTOGRAPHER_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * Generate a human-readable alt text suggestion from photo metadata fields.
 * This does NOT read from DB — it synthesizes from passed values.
 *
 * Priority: species > scene description > generic
 * Format: "[Subject] [context] near [Location], [Region/Province], Costa Rica"
 */
export function buildAltText(opts: {
  speciesCommonName?: string | null;
  speciesScientificName?: string | null;
  locationName?: string | null;
  region?: string | null;
  description?: string | null;
  sceneType?: string | null;
  title?: string | null;
}): string {
  const parts: string[] = [];

  if (opts.speciesCommonName) {
    const name = opts.speciesScientificName
      ? `${opts.speciesCommonName} (${opts.speciesScientificName})`
      : opts.speciesCommonName;
    parts.push(name);
  } else if (opts.sceneType) {
    parts.push(`${opts.sceneType.charAt(0).toUpperCase() + opts.sceneType.slice(1)} scene`);
  } else if (opts.description && opts.description.length > 5 && !opts.description.includes('Photography From')) {
    const short = opts.description.substring(0, 60).replace(/\.$/, '');
    parts.push(short);
  } else {
    parts.push('Nature photograph');
  }

  if (opts.locationName && opts.locationName !== 'Costa Rica' && opts.locationName !== 'Power-Of-Nature') {
    parts.push(`near ${opts.locationName}`);
  }

  if (opts.region && opts.region !== opts.locationName) {
    parts.push(opts.region);
  }

  parts.push('Costa Rica');

  return parts.join(' ');
}

/**
 * Generate SEO title for a photo following the preferred pattern.
 * This is a rule-based generator used by the backfill script.
 * Not used directly in page rendering (which reads from DB metadata).
 */
export function buildPhotoSeoTitle(opts: {
  speciesCommonName?: string | null;
  locationName?: string | null;
  region?: string | null;
  title?: string | null;
  slug?: string | null;
}): string {
  // Determine subject
  let subject = '';
  if (opts.speciesCommonName) {
    subject = opts.speciesCommonName;
  } else if (opts.title && opts.title.length > 3) {
    // Skip template patterns
    const skipPatterns = [
      /^landscape\s*—/i,
      /^Power-Of-Nature/i,
      /^Costa Rica Nature Photography/i,
      /^Costa Rica Food Photography/i,
      /^IMG_\d+$/i,
      /^DSC_\d+$/i,
      /^\d{3,}$/,
      /^cl0[a-z0-9]+$/i,
    ];
    const isTemplate = skipPatterns.some(p => p.test(opts.title || ''));
    if (!isTemplate) {
      subject = opts.title.replace(/\s*\|\s*WildPhotography\s*$/i, '').trim();
    }
  }

  if (!subject) {
    subject = 'Costa Rica Nature';
  }

  // Determine location
  let location = 'Costa Rica';
  if (opts.locationName && opts.locationName !== 'Costa Rica' && opts.locationName !== 'Power-Of-Nature') {
    location = `${opts.locationName}, Costa Rica`;
  } else if (opts.region) {
    location = `${opts.region}, Costa Rica`;
  }

  const raw = `${subject} in ${location} | ${SITE_NAME}`;
  return raw.length > 70 ? `${subject} in Costa Rica | ${SITE_NAME}` : raw;
}

/**
 * Generate SEO meta description for a photo (130-160 chars)
 */
export function buildPhotoSeoDescription(opts: {
  speciesCommonName?: string | null;
  locationName?: string | null;
  region?: string | null;
}): string {
  const subject = opts.speciesCommonName || 'Wildlife and nature';
  const loc = opts.locationName && opts.locationName !== 'Costa Rica' && opts.locationName !== 'Power-Of-Nature'
    ? opts.locationName
    : opts.region || 'Costa Rica';

  const base = `${subject} photograph from ${loc}, Costa Rica. Original photography by ${SITE_NAME} — professional wildlife photographer Joshua ten Brink documenting Costa Rica's natural beauty.`;
  if (base.length <= 160) return base;
  return `${subject} from ${loc}, Costa Rica. Original ${SITE_NAME} photography — professional wildlife images by Joshua ten Brink.`.substring(0, 157) + '...';
}
