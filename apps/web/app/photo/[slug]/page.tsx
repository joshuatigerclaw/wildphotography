import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { sql } from '@/lib/db';
import {
  getPhotoBySlug,
  getRelatedPhotos,
  getPhotosFromGallery,
  getGalleryForPhoto,
  getGalleryBySlug,
  getGalleriesForPhoto,
  getGallerySequenceForPhoto,
} from '@/lib/db';
import { generatePhotoJsonLd, generateBreadcrumbJsonLd, canonicalUrl, buildAltText } from '@/lib/seo';
import { getDisplayTitle } from '@/lib/titles';
import PhotoPageClient from './PhotoPageClient';

// ISR — revalidate every 60s instead of hitting Neon on every request
export const revalidate = 60;

const R2_PUBLIC = 'https://images.wildphotography.com';
const SITE_URL = 'https://wildphotography.com';

function withR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return { title: 'Photo Not Found' };
  }

  const displayTitle = getDisplayTitle(photo.title);
  const gallery = await getGalleryForPhoto(slug);

  const canonical = canonicalUrl(`/photo/${photo.slug}`);
  const ogImage = photo.mediumUrl || photo.smallUrl || photo.thumbUrl;

  // Use SEO metadata from DB when available; fall back to rule-based pattern
  // Validate stored titles to avoid malformed outputs (e.g. trailing 'in', 'Costa Rica, Costa Rica')
  const rawSeoTitle = photo.metadata?.seo_title;
  const seoTitle = rawSeoTitle && !/\s+in$/.test(rawSeoTitle) && !/Costa Rica,\s+Costa Rica/.test(rawSeoTitle)
    ? rawSeoTitle
    : null;
  const seoDescription = photo.metadata?.meta_description;

  // Build description from available metadata
  // Build description: avoid 'Costa Rica, Costa Rica' duplication
  let description = seoDescription || photo.description || '';
  if (!description) {
    const loc = photo.locationName
      ? photo.locationName.replace(/,\s*Costa Rica$/, '').trim()
      : (photo.region && photo.region !== 'Costa Rica' ? photo.region : null);
    if (loc) {
      description = `${displayTitle || 'Photo'} from ${loc}, Costa Rica`;
    } else if (gallery) {
      description = `${displayTitle || 'Photo'} in ${gallery.name} gallery`;
    }
  }

  // Better SEO title: prefer DB seo_title, then subject+location pattern, then displayTitle
  let pageTitle = seoTitle;
  if (!pageTitle) {
    const subject = photo.species_common_name || displayTitle || 'Costa Rica';
    const rawLocation = photo.locationName || photo.region || null;
    // Avoid appending location if it would duplicate geographic context in the subject
    // e.g. subject "Yacht in Costa Rican Waters" + location "Puntarenas, Costa Rica" → redundant
    const subjectLower = (photo.species_common_name || displayTitle || '').toLowerCase();
    const locationIsRedundant = rawLocation && (
      subjectLower.includes('costa ric') ||
      subjectLower.includes(rawLocation.toLowerCase().split(',')[0].trim())
    );
    const location = !locationIsRedundant && rawLocation && rawLocation !== 'Costa Rica'
      ? rawLocation
      : (!locationIsRedundant ? (photo.region || null) : null);

    if (location) {
      pageTitle = `${subject} in ${location}, Costa Rica | WildPhotography`;
      if (pageTitle.length > 70) {
        pageTitle = `${subject} in Costa Rica | WildPhotography`;
      }
    } else {
      pageTitle = `${subject} | WildPhotography`;
    }
  }

  return {
    title: `${pageTitle} | Wildphotography`,
    description: description || `Beautiful nature photography from Costa Rica`,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical },
    openGraph: {
      title: seoTitle || displayTitle || 'Photo',
      description: description || `Beautiful nature photography from Costa Rica`,
      url: canonical,
      siteName: 'Wildphotography',
      images: ogImage
        ? [{ url: ogImage, width: photo.width || 1200, height: photo.height || 800, alt: displayTitle || 'Photo' }]
        : [],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle || displayTitle || 'Photo',
      description: description || undefined,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function PhotoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fromGallery?: string }>;
}) {
  const { slug } = await params;
  const { fromGallery: fromGallerySlug } = await searchParams;

  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    notFound();
  }

  // ── All galleries this photo belongs to ───────────────────────────────
  let allGalleries: any[] = [];
  try {
    allGalleries = await getGalleriesForPhoto(slug);
  } catch (e) {
    console.error('Error fetching galleries for photo:', e);
  }

  // ── Primary gallery ─────────────────────────────────────────────────
  const primaryGallery = allGalleries[0] ?? null;

  // ── Source gallery ──────────────────────────────────────────────────
  let sourceGallery = primaryGallery;
  if (fromGallerySlug) {
    if (fromGallerySlug === primaryGallery?.slug) {
      sourceGallery = primaryGallery;
    } else {
      const found = allGalleries.find(g => g.slug === fromGallerySlug);
      if (found) {
        sourceGallery = found;
      } else {
        try {
          const fromGalleryData = await getGalleryBySlug(fromGallerySlug);
          if (fromGalleryData) sourceGallery = fromGalleryData;
        } catch {
          // Fall back silently
        }
      }
    }
  }

  // ── Gallery sequence ────────────────────────────────────────────────
  let sequence = null;
  if (sourceGallery) {
    try {
      sequence = await getGallerySequenceForPhoto(slug, sourceGallery.id);
      if (sequence.total === 0 && primaryGallery && sourceGallery.id !== primaryGallery.id) {
        sequence = await getGallerySequenceForPhoto(slug, primaryGallery.id);
        sourceGallery = primaryGallery;
      }
    } catch (e) {
      console.error('Error fetching gallery sequence:', e);
    }
  }

  // ── Related photos (keyword-based, existing logic) ─────────────────
  let relatedPhotos: any[] = [];
  try {
    relatedPhotos = await getRelatedPhotos(slug, undefined, photo.keywords || '', 8);
  } catch (e) {
    console.error('Error fetching related photos:', e);
  }

  // ── More photos from primary gallery ────────────────────────────────
  let galleryPhotos: any[] = [];
  if (primaryGallery) {
    try {
      galleryPhotos = await getPhotosFromGallery(primaryGallery.slug, slug, 8);
    } catch (e) {
      console.error('Error fetching gallery photos:', e);
    }
  }

  // ── PAGE LINKS: More from same species (via page_links) ─────────────
  let speciesPhotos: any[] = [];
  try {
    const speciesResult = await sql`
      SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
             p.species_common_name, p.location
      FROM photos p
      JOIN page_links pl ON pl.target_type = 'photo' AND pl.target_id = p.id
      WHERE pl.source_type = 'species'
        AND pl.source_id IN (
          SELECT target_id FROM page_links
          WHERE source_type = 'photo' AND source_id = ${parseInt(photo.id)}
            AND target_type = 'species'
        )
        AND p.id != ${parseInt(photo.id)}
        AND p.is_active = true AND p.ready_for_public_render = true
      ORDER BY p.popularity DESC NULLS LAST
      LIMIT 12
    `;
    speciesPhotos = (speciesResult as any[]).map((row: any) => ({
      id: String(row.id),
      slug: row.slug,
      title: row.title || '',
      thumbUrl: withR2(row.thumb_url),
      smallUrl: withR2(row.small_url),
      species_common_name: row.species_common_name,
      locationName: row.location,
    }));
  } catch (e) {
    console.error('Error fetching species photos:', e);
  }

  // ── PAGE LINKS: More from same location (via page_links) ───────────
  let locationPhotos: any[] = [];
  try {
    const locationResult = await sql`
      SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
             p.species_common_name, p.location
      FROM photos p
      JOIN page_links pl ON pl.target_type = 'photo' AND pl.target_id = p.id
      WHERE pl.source_type = 'location'
        AND pl.source_id IN (
          SELECT target_id FROM page_links
          WHERE source_type = 'photo' AND source_id = ${parseInt(photo.id)}
            AND target_type = 'location'
        )
        AND p.id != ${parseInt(photo.id)}
        AND p.is_active = true AND p.ready_for_public_render = true
      ORDER BY p.popularity DESC NULLS LAST
      LIMIT 12
    `;
    locationPhotos = (locationResult as any[]).map((row: any) => ({
      id: String(row.id),
      slug: row.slug,
      title: row.title || '',
      thumbUrl: withR2(row.thumb_url),
      smallUrl: withR2(row.small_url),
      species_common_name: row.species_common_name,
      locationName: row.location,
    }));
  } catch (e) {
    console.error('Error fetching location photos:', e);
  }

  // ── Also appears in (other galleries containing this photo) ─────────
  let alternateGalleryPhotos: any[] = [];
  try {
    if (allGalleries.length > 1) {
      const otherGalleries = allGalleries.filter(g => g.id !== primaryGallery?.id);
      const galleryIds = otherGalleries.map(g => parseInt(g.id));
      if (galleryIds.length > 0) {
        const altResult = await sql`
          SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
                 p.species_common_name, p.location,
                 g.id as gallery_id, g.name as gallery_name, g.slug as gallery_slug
          FROM photos p
          JOIN gallery_photos gp ON gp.photo_id = p.id
          JOIN galleries g ON g.id = gp.gallery_id
          WHERE gp.gallery_id = ANY(${galleryIds})
            AND p.id != ${parseInt(photo.id)}
            AND p.is_active = true AND p.ready_for_public_render = true
          ORDER BY p.popularity DESC NULLS LAST
          LIMIT 12
        `;
        alternateGalleryPhotos = (altResult as any[]).map((row: any) => ({
          id: String(row.id),
          slug: row.slug,
          title: row.title || '',
          thumbUrl: withR2(row.thumb_url),
          smallUrl: withR2(row.small_url),
          species_common_name: row.species_common_name,
          locationName: row.location,
          galleryName: row.gallery_name,
          gallerySlug: row.gallery_slug,
        }));
      }
    }
  } catch (e) {
    console.error('Error fetching alternate gallery photos:', e);
  }

  // ── JSON-LD structured data — use SEO metadata when available ─────────
  const displayTitle = getDisplayTitle(photo.title);
  const seoTitle = photo.metadata?.seo_title;
  const seoDescription = photo.metadata?.meta_description;
  const photoTitle = seoTitle || displayTitle || 'Photo';

  // Build descriptive alt text (rule-based fallback; DB seo metadata takes priority)
  const altText = seoTitle || buildAltText({
    speciesCommonName: photo.species_common_name,
    speciesScientificName: photo.species_scientific_name,
    locationName: photo.locationName,
    region: photo.region,
    description: photo.description,
    title: photo.title,
  });

  const jsonLd = generatePhotoJsonLd({
    title: photoTitle,
    description: seoDescription || photo.description || undefined,
    imageUrl: photo.mediumUrl || photo.smallUrl || '',
    thumbUrl: photo.thumbUrl || undefined,
    dateTaken: photo.date_taken ? new Date(photo.date_taken) : undefined,
    location: photo.locationName || undefined,
    region: photo.region || undefined,
    country: photo.country || undefined,
    width: photo.width || undefined,
    height: photo.height || undefined,
    slug: photo.slug,
    photographerName: 'Joshua ten Brink',
  });

  // ── BreadcrumbList JSON-LD ────────────────────────────────────────────
  const breadcrumbs = [
    { name: 'Home', url: '/' },
  ];
  if (photo.species_common_name) {
    breadcrumbs.push({ name: 'Costa Rica Wildlife', url: '/species' });
    breadcrumbs.push({ name: photo.species_common_name, url: `/species/${photo.species_common_name.toLowerCase().replace(/\s+/g, '-')}` });
  } else if (photo.locationName && photo.locationName !== 'Costa Rica' && photo.locationName !== 'Power-Of-Nature') {
    breadcrumbs.push({ name: 'Locations', url: '/location' });
    breadcrumbs.push({ name: photo.locationName, url: `/location/${photo.locationName.toLowerCase().replace(/\s+/g, '-')}` });
  }
  if (primaryGallery) {
    breadcrumbs.push({ name: primaryGallery.name, url: `/gallery/${primaryGallery.slug}` });
  }
  breadcrumbs.push({ name: photoTitle, url: `/photo/${photo.slug}` });
  const breadcrumbJsonLd = generateBreadcrumbJsonLd(breadcrumbs);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PhotoPageClient
        photo={photo}
        relatedPhotos={relatedPhotos}
        galleryPhotos={galleryPhotos}
        gallery={primaryGallery}
        sequence={sequence}
        sourceGallery={sourceGallery}
        allGalleries={allGalleries}
        speciesPhotos={speciesPhotos}
        locationPhotos={locationPhotos}
        alternateGalleryPhotos={alternateGalleryPhotos}
        altText={altText}
      />
    </>
  );
}
