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
import { generatePhotoJsonLd, canonicalUrl } from '@/lib/seo';
import { getDisplayTitle } from '@/lib/titles';
import PhotoPageClient from './PhotoPageClient';

export const dynamic = 'force-dynamic';

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

  // Use SEO metadata from DB when available
  const seoTitle = photo.metadata?.seo_title;
  const seoDescription = photo.metadata?.meta_description;

  let description = seoDescription || photo.description || '';
  if (!description && photo.locationName) {
    description = `${displayTitle || 'Photo'} from ${photo.locationName}, Costa Rica`;
  }
  if (!description && gallery) {
    description = `${displayTitle || 'Photo'} in ${gallery.name} gallery`;
  }

  const pageTitle = seoTitle || displayTitle || 'Photo';

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
  const jsonLd = generatePhotoJsonLd({
    title: seoTitle || displayTitle || 'Photo',
    description: seoDescription || photo.description || undefined,
    imageUrl: photo.mediumUrl || photo.smallUrl || '',
    dateTaken: photo.date_taken ? new Date(photo.date_taken) : undefined,
    location: photo.locationName || undefined,
    width: photo.width || undefined,
    height: photo.height || undefined,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
      />
    </>
  );
}
