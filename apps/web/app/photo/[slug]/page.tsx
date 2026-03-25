import { notFound } from 'next/navigation';
import { Metadata } from 'next';
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

const SITE_URL = 'https://wildphotography.com';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return { title: 'Photo Not Found' };
  }

  const displayTitle = getDisplayTitle(photo.title);
  const gallery = await getGalleryForPhoto(slug);

  // Canonical always points to the clean /photo/{slug} URL — query params are UX-only
  const canonical = canonicalUrl(`/photo/${photo.slug}`);
  const ogImage = photo.mediumUrl || photo.smallUrl || photo.thumbUrl;

  let description = photo.description || '';
  if (!description && photo.locationName) {
    description = `${displayTitle || 'Photo'} from ${photo.locationName}, Costa Rica`;
  }
  if (!description && gallery) {
    description = `${displayTitle || 'Photo'} in ${gallery.name} gallery`;
  }

  return {
    title: `${displayTitle || 'Photo'} | Wildphotography`,
    description: description || `Beautiful nature photography from Costa Rica`,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical },
    openGraph: {
      title:displayTitle || 'Photo',
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
      title: displayTitle || 'Photo',
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

  // ── All galleries this photo belongs to (deterministic order) ─────────
  // Fetched once; used for both fallback selection and "Also appears in" UI.
  let allGalleries: any[] = [];
  try {
    allGalleries = await getGalleriesForPhoto(slug);
  } catch (e) {
    console.error('Error fetching galleries for photo:', e);
  }

  // ── Primary gallery (first in deterministic order) ────────────────────
  // Used for metadata, breadcrumb, discovery links, and "More from" section.
  // Deterministic fallback rule: lowest sort_order → lowest gallery id.
  const primaryGallery = allGalleries[0] ?? null;

  // ── Source gallery (the gallery the user navigated from) ──────────────
  // If fromGallery is provided and valid, use it; otherwise fall back to
  // primaryGallery so the context line / nav always has something to show.
  let sourceGallery = primaryGallery;

  if (fromGallerySlug) {
    if (fromGallerySlug === primaryGallery?.slug) {
      // Already have it — no extra fetch needed
      sourceGallery = primaryGallery;
    } else {
      // Try to find it in allGalleries first (avoids an extra DB query)
      const found = allGalleries.find(g => g.slug === fromGallerySlug);
      if (found) {
        sourceGallery = found;
      } else {
        // Not in the photo's gallery list — could be a stale/invalid param.
        // Try fetching anyway in case getGalleriesForPhoto missed something.
        try {
          const fromGalleryData = await getGalleryBySlug(fromGallerySlug);
          if (fromGalleryData) sourceGallery = fromGalleryData;
        } catch {
          // Fall back to primaryGallery silently
        }
      }
    }
  }

  // ── Gallery sequence — derived from sourceGallery ─────────────────────
  let sequence = null;
  if (sourceGallery) {
    try {
      sequence = await getGallerySequenceForPhoto(slug, sourceGallery.id);
      // If photo not found in sourceGallery, fall back to primaryGallery sequence
      if (sequence.total === 0 && primaryGallery && sourceGallery.id !== primaryGallery.id) {
        sequence = await getGallerySequenceForPhoto(slug, primaryGallery.id);
        sourceGallery = primaryGallery;
      }
    } catch (e) {
      console.error('Error fetching gallery sequence:', e);
    }
  }

  // ── Related photos by keywords ────────────────────────────────────────
  let relatedPhotos: any[] = [];
  try {
    relatedPhotos = await getRelatedPhotos(slug, undefined, photo.keywords || '', 8);
  } catch (e) {
    console.error('Error fetching related photos:', e);
  }

  // ── More photos from primary gallery ─────────────────────────────────
  let galleryPhotos: any[] = [];
  if (primaryGallery) {
    try {
      galleryPhotos = await getPhotosFromGallery(primaryGallery.slug, slug, 8);
    } catch (e) {
      console.error('Error fetching gallery photos:', e);
    }
  }

  // ── JSON-LD structured data ───────────────────────────────────────────
  const displayTitle = getDisplayTitle(photo.title);
  const jsonLd = generatePhotoJsonLd({
    title: displayTitle,
    description: photo.description || undefined,
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
      />
    </>
  );
}
