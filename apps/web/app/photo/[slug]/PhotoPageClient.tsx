'use client';

import { useState, useEffect, useMemo } from 'react';
import { rankAlternateGalleries } from '@/lib/gallery-ranking';
import Link from 'next/link';
import { PhotoLightbox, PhotoSlide } from '@/components/PhotoLightbox';
import LocationMap from '@/components/LocationMap';
import VirtualizedGallery from '@/components/VirtualizedGallery';
import { getDisplayTitle, looksLikeFilename } from '@/lib/titles';
import PhotoViatorBlock from '@/components/PhotoViatorBlock';

// ============================================================
// Types
// ============================================================

interface PhotoSEOData {
  seo_title?:       string | null;
  meta_description?: string | null;
  keyword_clusters?: {
    primary_kw?:       string[];
    species_kw?:        string[];
    location_kw?:      string[];
    travel_intent_kw?: string[];
    photography_kw?:    string[];
    longtail_kw?:       string[];
  };
  affiliate_blurb?: string | null;
  viator_dest?:     string | null;
}

interface PhotoData {
  id: string;
  slug: string;
  title: string | null;
  description?: string | null;
  description_long?: string | null;
  keywords?: string | null;
  locationName?: string | null;
  region?: string | null;
  country?: string | null;
  species_common_name?: string | null;
  species_scientific_name?: string | null;
  width?: number | null;
  height?: number | null;
  camera_make?: string | null;
  camera_model?: string | null;
  lens?: string | null;
  iso?: number | null;
  aperture?: string | null;
  shutter_speed?: string | null;
  focal_length_mm?: number | null;
  lat?: number | null;
  lon?: number | null;
  views_count?: number | null;
  date_taken?: string | null;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  largeUrl?: string | null;
  /** JSONB metadata from DB — contains seo_title, meta_description, keyword_clusters, affiliate_blurb */
  metadata?: PhotoSEOData | null;
}

interface RelatedPhoto {
  id: string;
  slug: string;
  title: string | null;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  keywords?: string | null;
  locationName?: string | null;
  galleryName?: string | null;
  gallerySlug?: string | null;
}

interface GalleryContext {
  id: string;
  slug: string;
  name: string;
  /** From galleries.gallery_type (species | location | region | theme) */
  galleryType?: string | null;
  /** Total photos in this gallery */
  photoCount?: number | null;
  /** From galleries.has_affiliate_content */
  hasAffiliateContent?: boolean | null;
}

interface SequencePhoto {
  id: string;
  slug: string;
  title: string | null;
  thumbUrl: string | null;
}

interface GallerySequence {
  previousPhoto: SequencePhoto | null;
  nextPhoto: SequencePhoto | null;
  position: number;
  total: number;
}

interface PhotoPageClientProps {
  photo: PhotoData;
  relatedPhotos?: RelatedPhoto[];
  galleryPhotos?: RelatedPhoto[];
  /** Photos from page_links: same species */
  speciesPhotos?: RelatedPhoto[];
  /** Photos from page_links: same location */
  locationPhotos?: RelatedPhoto[];
  /** Photos from other galleries containing this photo */
  alternateGalleryPhotos?: RelatedPhoto[];
  /** The photo's primary gallery — used for metadata, breadcrumb, discovery links */
  gallery?: GalleryContext | null;
  /** Sequence within the sourceGallery */
  sequence?: GallerySequence | null;
  /**
   * The gallery the user navigated from (fromGallery context).
   * Used for the nav bar, prev/next links, and the return-to-gallery action.
   * Falls back to `gallery` when absent or same.
   */
  sourceGallery?: GalleryContext | null;
  /**
   * All galleries this photo belongs to (deterministic order).
   * Used for multi-gallery "Also appears in" discovery without breaking active context.
   */
  allGalleries?: GalleryContext[];
}

// ============================================================
// Helper Components
// ============================================================

/**
 * Context banner — shown when a valid gallery sequence exists.
 * "Viewing image 7 of 24 from Carara National Park"
 */
function ContextBanner({
  sequence,
  gallery,
  photoSlug,
}: {
  sequence: GallerySequence;
  gallery: GalleryContext;
  photoSlug: string;
}) {
  if (!sequence.total || !sequence.position) return null;

  // Return URL reopens the same image in the modal
  const returnUrl = `/gallery/${gallery.slug}?photo=${photoSlug}`;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg mb-4 text-sm">
      <span className="text-gray-500">
        Viewing image{' '}
        <span className="font-semibold text-gray-700">{sequence.position}</span>
        {' '}of{' '}
        <span className="font-semibold text-gray-700">{sequence.total}</span>
        {' '}from{' '}
        <Link
          href={returnUrl}
          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {gallery.name}
        </Link>
      </span>
      <Link
        href={returnUrl}
        className="shrink-0 text-xs text-gray-500 hover:text-blue-600 transition-colors whitespace-nowrap"
      >
        ← Back to gallery
      </Link>
    </div>
  );
}

/**
 * Previous / Next navigation bar.
 * When sourceGallery context is present, prev/next links carry ?fromGallery=
 * so the next photo page also knows its originating gallery.
 * The centre "back" link returns to the gallery with the modal reopened.
 */
function GalleryNavBar({
  sequence,
  gallery,
  photoSlug,
}: {
  sequence: GallerySequence;
  gallery: GalleryContext;
  photoSlug: string;
}) {
  const { previousPhoto, nextPhoto, position, total } = sequence;

  // Build prev/next URLs that carry fromGallery context forward
  const prevHref = previousPhoto
    ? `/photo/${previousPhoto.slug}?fromGallery=${gallery.slug}`
    : null;
  const nextHref = nextPhoto
    ? `/photo/${nextPhoto.slug}?fromGallery=${gallery.slug}`
    : null;

  // Back to gallery reopens the current image in the modal
  const backHref = `/gallery/${gallery.slug}?photo=${photoSlug}`;

  return (
    <nav
      className="flex items-center justify-between gap-3 py-3 border-y border-gray-100 mb-6"
      aria-label="Gallery navigation"
    >
      {/* Previous */}
      {prevHref ? (
        <Link
          href={prevHref}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors group"
          aria-label="Previous photo"
        >
          <span className="text-lg leading-none group-hover:-translate-x-0.5 transition-transform">←</span>
          <span className="hidden sm:inline">Previous</span>
        </Link>
      ) : (
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-not-allowed select-none">
          <span className="text-lg leading-none">←</span>
          <span className="hidden sm:inline">Previous</span>
        </span>
      )}

      {/* Centre: gallery name + position + back */}
      <div className="flex flex-col items-center gap-1 text-center">
        <Link
          href={backHref}
          className="text-xs font-semibold uppercase tracking-wider text-blue-600 hover:text-blue-800 transition-colors"
        >
          {gallery.name}
        </Link>
        {total > 0 && (
          <span className="text-xs text-gray-400">
            Image {position} of {total}
          </span>
        )}
      </div>

      {/* Next */}
      {nextHref ? (
        <Link
          href={nextHref}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors group"
          aria-label="Next photo"
        >
          <span className="hidden sm:inline">Next</span>
          <span className="text-lg leading-none group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      ) : (
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-not-allowed select-none">
          <span className="hidden sm:inline">Next</span>
          <span className="text-lg leading-none">→</span>
        </span>
      )}
    </nav>
  );
}

/** Compact metadata block — always uses the photo's primary gallery */
function MetadataBlock({ photo, gallery }: { photo: PhotoData; gallery?: GalleryContext | null }) {
  const rows: { label: string; value: string; href?: string }[] = [];

  if (gallery) {
    rows.push({ label: 'Gallery', value: gallery.name, href: `/gallery/${gallery.slug}` });
  }
  if (photo.locationName) {
    rows.push({ label: 'Location', value: photo.locationName });
  }
  if (photo.region) {
    rows.push({ label: 'Region', value: photo.region });
  }
  if (photo.species_common_name) {
    rows.push({ label: 'Species', value: photo.species_common_name });
  }
  if (photo.species_scientific_name) {
    rows.push({ label: 'Scientific Name', value: photo.species_scientific_name });
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <dl className="divide-y divide-gray-50">
        {rows.map(({ label, value, href }) => (
          <div key={label} className="flex justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
            <dt className="text-gray-400 shrink-0">{label}</dt>
            <dd className="text-gray-800 font-medium text-right">
              {href ? (
                <Link href={href} className="text-blue-600 hover:underline">
                  {value}
                </Link>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Internal discovery links — enriched with SEO keyword clusters */
function DiscoveryLinks({ photo, gallery, clusters }: { photo: PhotoData; gallery?: GalleryContext | null; clusters?: PhotoSEOData['keyword_clusters'] }) {
  const links: { label: string; href: string }[] = [];

  if (gallery) {
    links.push({ label: `View full gallery`, href: `/gallery/${gallery.slug}` });
  }
  if (photo.species_common_name && clusters?.species_kw?.length) {
    const primarySpecies = clusters.species_kw[0];
    if (primarySpecies) {
      links.push({
        label: `More ${primarySpecies} photos`,
        href: `/species/${encodeURIComponent(primarySpecies.replace(/\s+/g, '-'))}`,
      });
    }
  }
  if (photo.locationName && clusters?.location_kw?.length) {
    const primaryLoc = clusters.location_kw[0];
    if (primaryLoc) {
      links.push({
        label: `Explore ${photo.locationName}`,
        href: `/location/${encodeURIComponent(primaryLoc.replace(/\s+/g, '-'))}`,
      });
    }
  }
  if (photo.region) {
    links.push({
      label: `Explore ${photo.region}`,
      href: `/region/${encodeURIComponent(photo.region.toLowerCase().replace(/\s+/g, '-'))}`,
    });
  }

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-full px-3 py-1.5 transition-colors bg-white"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

/** Compact CTA — shown only when travel intent is clear */
function CompactCTA({ photo }: { photo: PhotoData }) {
  const location = photo.locationName;
  const region = photo.region;
  const hasSpecies = !!photo.species_common_name;

  if (!location && !region && !hasSpecies) return null;

  let ctaText = 'Explore more of Costa Rica';
  let ctaSubtext = 'Discover tours, wildlife, and nature experiences';
  let searchQuery = 'Costa Rica nature tours';

  if (location) {
    ctaText = `Explore tours near ${location}`;
    ctaSubtext = `Find guided experiences close to ${location}`;
    searchQuery = `${location} Costa Rica tours`;
  } else if (hasSpecies) {
    ctaText = 'See wildlife experiences nearby';
    ctaSubtext = 'Guided nature and birdwatching tours in Costa Rica';
    searchQuery = 'Costa Rica wildlife tours';
  } else if (region) {
    ctaText = `Explore more from ${region}`;
    ctaSubtext = `Tours and experiences in the ${region} region`;
    searchQuery = `${region} Costa Rica tours`;
  }

  const gyg = `https://www.getyourguide.com/s/?q=${encodeURIComponent(searchQuery)}&partner_id=WILD`;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <p className="text-sm font-semibold text-blue-900 mb-0.5">{ctaText}</p>
      <p className="text-xs text-blue-700 mb-3">{ctaSubtext}</p>
      <a
        href={gyg}
        target="_blank"
        rel="noopener sponsored"
        className="inline-block text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 transition-colors"
      >
        Browse experiences
      </a>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function PhotoPageClient({
  photo,
  relatedPhotos = [],
  galleryPhotos = [],
  speciesPhotos = [],
  locationPhotos = [],
  alternateGalleryPhotos = [],
  gallery,
  sequence,
  sourceGallery,
  allGalleries = [],
}: PhotoPageClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExif, setShowExif] = useState(false);

  const displayTitle = useMemo(() => {
    const title = getDisplayTitle(photo.title);
    const isUgly = !title || looksLikeFilename(title);
    return { title, isUgly };
  }, [photo.title]);


  // ── Record visit on mount ──────────────────────────────────
  useEffect(() => {
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id, slug: photo.slug }),
    }).catch(console.error);
  }, [photo.id, photo.slug]);

  // ── Derived context ────────────────────────────────────────
  // navGallery: the gallery used for prev/next, back link, and context banner.
  // Falls back through sourceGallery → gallery.
  const navGallery = sourceGallery || gallery;

  // Sequence is valid only when the photo was found in navGallery (position > 0)
  const validSequence = sequence && sequence.total > 0 && sequence.position > 0
    ? sequence
    : null;

  // Return-to-gallery URL reopens the modal on this photo
  const returnToGalleryUrl = navGallery
    ? `/gallery/${navGallery.slug}?photo=${photo.slug}`
    : '/galleries';
  const returnToGalleryLabel = navGallery ? navGallery.name : 'Gallery';

  // ── Promoted alternate galleries (Project 19: editorial promotion logic) ──
  // Ranks alternate galleries by relevance, intent, monetization, content
  // quality, diversity, and redundancy. Returns top 2 that score ≥ 6.
  // Falls back to showing top 2 by position when metadata is absent.
  const promotedGalleries = useMemo(() => {
    if (!navGallery || allGalleries.length <= 1) return [];
    const alternates = allGalleries.filter(g => g.id !== navGallery.id);
    if (alternates.length === 0) return [];
    // Detect whether promotion metadata is available from the DB.
    // If not, bypass the score threshold so position-order applies.
    const hasMetadata = allGalleries.some(
      g =>
        (g.galleryType && g.galleryType !== 'theme') ||
        (g.photoCount != null && g.photoCount > 0) ||
        g.hasAffiliateContent,
    );
    return rankAlternateGalleries(alternates, navGallery, {
      maxResults: 2,
      minScore: hasMetadata ? 6 : 0,
    });
  }, [allGalleries, navGallery]);

  // ── Lightbox slides ────────────────────────────────────────
  const slides: PhotoSlide[] = [
    {
      id: photo.id,
      src: photo.largeUrl || photo.mediumUrl || photo.smallUrl || '',
      alt: displayTitle.title || 'Photo',
      title: displayTitle.title,
    },
  ].filter(s => s.src);

  // ── Purchase ───────────────────────────────────────────────
  const handlePurchase = async () => {
    setPurchasing(true);
    setError(null);
    try {
      const response = await fetch('/api/paypal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: parseInt(photo.id) }),
      });
      const data = await response.json();
      if (data.error) { setError(data.error); return; }
      if (data.approvalUrl) window.location.href = data.approvalUrl;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing(false);
    }
  };

  const keywordsArray = photo.keywords
    ? photo.keywords.split(',').map(k => k.trim()).filter(Boolean)
    : [];

  const hasLocation = photo.lat && photo.lon && photo.lat !== 0 && photo.lon !== 0;

  const exifDetails = [
    photo.width && photo.height && { label: 'Dimensions', value: `${photo.width} × ${photo.height}` },
    photo.camera_make && { label: 'Camera', value: [photo.camera_make, photo.camera_model].filter(Boolean).join(' ') },
    photo.lens && { label: 'Lens', value: photo.lens },
    photo.focal_length_mm && { label: 'Focal Length', value: `${photo.focal_length_mm}mm` },
    photo.aperture && { label: 'Aperture', value: photo.aperture },
    photo.shutter_speed && { label: 'Shutter', value: photo.shutter_speed },
    photo.iso && { label: 'ISO', value: photo.iso.toString() },
    photo.date_taken && { label: 'Taken', value: new Date(photo.date_taken).toLocaleDateString() },
  ].filter(Boolean);

  return (
    <>
      <div className="container mx-auto px-4 py-6 max-w-6xl">

        {/* Breadcrumb — uses primary gallery */}
        <nav className="text-sm mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 flex-wrap">
            <li><Link href="/" className="text-blue-600 hover:underline">Home</Link></li>
            <li className="text-gray-400">/</li>
            <li><Link href="/galleries" className="text-blue-600 hover:underline">Galleries</Link></li>
            {gallery && (
              <>
                <li className="text-gray-400">/</li>
                <li>
                  <Link href={`/gallery/${gallery.slug}`} className="text-blue-600 hover:underline">
                    {gallery.name}
                  </Link>
                </li>
              </>
            )}
            <li className="text-gray-400">/</li>
            <li className="text-gray-600 truncate max-w-[200px]" aria-current="page">
              {displayTitle.title || 'Photo'}
            </li>
          </ol>
        </nav>

        {/* Back to gallery — uses navGallery, returns to modal view */}
        <div className="mb-4">
          <Link
            href={returnToGalleryUrl}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <span>←</span>
            <span>Back to {returnToGalleryLabel}</span>
          </Link>
        </div>

        {/* Context banner: "Viewing image X of Y from {gallery}" */}
        {validSequence && navGallery && (
          <ContextBanner
            sequence={validSequence}
            gallery={navGallery}
            photoSlug={photo.slug}
          />
        )}

        {/* Cross-gallery discovery — editorially ranked, top 2 only (Project 19) */}
        {promotedGalleries.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4 text-xs">
            <span className="text-gray-400 shrink-0">Also in:</span>
            {promotedGalleries.map(g => (
              <Link
                key={g.id}
                href={`/photo/${photo.slug}?fromGallery=${g.slug}`}
                className="text-blue-600 hover:text-blue-800 border border-blue-100 hover:border-blue-300 rounded-full px-2.5 py-0.5 bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                {g.name}
              </Link>
            ))}
          </div>
        )}

        {/* Gallery prev / next navigation bar */}
        {validSequence && navGallery && (
          <GalleryNavBar
            sequence={validSequence}
            gallery={navGallery}
            photoSlug={photo.slug}
          />
        )}

        {/* Title — full width, above everything */}
        <div className="mb-4">
          {(() => {
            const seoTitle = photo.metadata?.seo_title;
            const h1Text = seoTitle || (displayTitle.isUgly
              ? (photo.locationName || photo.species_common_name || (gallery ? `From ${gallery.name}` : 'Photo'))
              : displayTitle.title);
            return (
              <h1 className={`font-bold text-gray-900 ${seoTitle || !displayTitle.isUgly ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'}`}>
                {h1Text}
              </h1>
            );
          })()}
        </div>

        {/* Main image — full width hero, below title */}
        <div className="mb-8">
          <div
            className="cursor-zoom-in rounded-xl overflow-hidden shadow-2xl"
            onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
          >
            {photo.mediumUrl && (
              <img
                src={photo.mediumUrl}
                alt={displayTitle.title || 'Photo'}
                className="w-full h-auto rounded-xl"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px"
                loading="eager"
              />
            )}
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">Click to view fullscreen</p>
        </div>

        {/* Viator affiliate block — between image and description */}
        <div className="mb-8">
          <PhotoViatorBlock
            blurb={photo.metadata?.affiliate_blurb}
            location={photo.locationName}
            region={photo.region}
            species={photo.species_common_name}
            viatorDest={photo.metadata?.viator_dest}
          />
        </div>

        {/* Description — below image and Viator, above the two-column grid */}
        <div className="mb-8">
          {(photo.metadata?.meta_description || photo.description_long || photo.description) && (
            <p className="text-gray-600 text-base leading-relaxed max-w-3xl">
              {photo.metadata?.meta_description || photo.description_long || photo.description}
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left column — main content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Keyword chips — use SEO clusters when available */}
            {(() => {
              const clusters = photo.metadata?.keyword_clusters;
              const primaryKws = clusters?.primary_kw?.length
                ? clusters.primary_kw.slice(0, 14)
                : keywordsArray.slice(0, 14);
              if (primaryKws.length === 0) return null;
              return (
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Keywords</h2>
                  <div className="flex flex-wrap gap-2">
                    {primaryKws.map(keyword => (
                      <Link
                        key={keyword}
                        href={`/search?q=${encodeURIComponent(keyword)}`}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-full text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                      >
                        {keyword}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Location / metadata row */}
            <MetadataBlock photo={photo} gallery={gallery} />

            {/* Discovery links */}
            <DiscoveryLinks photo={photo} gallery={gallery} clusters={photo.metadata?.keyword_clusters} />

            {/* Location map */}
            {hasLocation && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Location</h2>
                <LocationMap
                  lat={photo.lat!}
                  lon={photo.lon!}
                  locationName={photo.locationName || 'Costa Rica'}
                />
              </div>
            )}

            {/* More from this gallery */}
            {galleryPhotos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                  More from {gallery?.name || 'this gallery'}
                </h2>
                <VirtualizedGallery
                  photos={galleryPhotos.map(p => ({
                    ...p,
                    title: p.title || 'Photo',
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
                {gallery && (
                  <div className="mt-3">
                    <Link
                      href={`/gallery/${gallery.slug}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View all photos in {gallery.name} &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Related photos */}
            {relatedPhotos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Related Photos</h2>
                <VirtualizedGallery
                  photos={relatedPhotos.map(p => ({
                    ...p,
                    title: p.title || 'Photo',
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
              </div>
            )}

            {/* More of this species (page_links) */}
            {speciesPhotos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                  More of {photo.species_common_name || 'this species'}
                </h2>
                <VirtualizedGallery
                  photos={speciesPhotos.map(p => ({
                    ...p,
                    title: p.title || 'Photo',
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
                {photo.species_common_name && (
                  <div className="mt-3">
                    <Link
                      href={`/species/${encodeURIComponent(photo.species_common_name.toLowerCase().replace(/\s+/g, '-'))}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View full {photo.species_common_name} species page &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Seen in this location (page_links) */}
            {locationPhotos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                  Seen in {photo.locationName || 'this location'}
                </h2>
                <VirtualizedGallery
                  photos={locationPhotos.map(p => ({
                    ...p,
                    title: p.title || 'Photo',
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
              </div>
            )}

            {/* Also appears in (other galleries via gallery_photos) */}
            {alternateGalleryPhotos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Also appears in</h2>
                <VirtualizedGallery
                  photos={alternateGalleryPhotos.map(p => ({
                    ...p,
                    title: p.title || 'Photo',
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
                {allGalleries.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allGalleries.filter(g => g.id !== gallery?.id).map(g => (
                      <Link
                        key={g.id}
                        href={`/gallery/${g.slug}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {g.name} gallery &rarr;
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column — sidebar */}
          <div className="space-y-5">

            {/* Technical details */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <button
                onClick={() => setShowExif(!showExif)}
                className="w-full flex justify-between items-center mb-3"
              >
                <h3 className="text-base font-semibold">Technical Details</h3>
                <span className="text-gray-400">{showExif ? '−' : '+'}</span>
              </button>

              {showExif && (
                <div className="space-y-2 text-sm">
                  {exifDetails.map((detail: any, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-500">{detail.label}</span>
                      <span className="font-medium">{detail.value}</span>
                    </div>
                  ))}
                  {exifDetails.length === 0 && (
                    <p className="text-gray-400 text-sm">No technical details available</p>
                  )}
                </div>
              )}

              {photo.views_count != null && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">{photo.views_count}</span> views
                  </p>
                </div>
              )}
            </div>

            {/* Purchase */}
            <div className="bg-gray-900 rounded-xl p-5 text-white shadow-lg">
              <h3 className="text-lg font-semibold mb-3">Purchase</h3>

              {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-200 rounded-lg text-sm">{error}</div>
              )}

              <div className="space-y-2">
                <button
                  className="w-full px-4 py-3 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
                  disabled
                >
                  Print (Coming Soon)
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {purchasing ? 'Processing...' : 'Download High-Res — $29'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">Secure payment via PayPal</p>
            </div>

            {/* Sidebar gallery navigation — context-aware prev/next + return */}
            {validSequence && navGallery && (
              <div className="hidden lg:blockbg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Gallery Navigation
                </p>
                <div className="flex flex-col gap-2 text-sm">
                  {validSequence.previousPhoto ? (
                    <Link
                      href={`/photo/${validSequence.previousPhoto.slug}?fromGallery=${navGallery.slug}`}
                      className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <span>←</span>
                      <span className="truncate">
                        {validSequence.previousPhoto.title || 'Previous photo'}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-gray-300 flex items-center gap-2">
                      <span>←</span><span>First image</span>
                    </span>
                  )}
                  <Link
                    href={`/gallery/${navGallery.slug}?photo=${photo.slug}`}
                    className="text-center text-blue-600 hover:underline py-1"
                  >
                    Back to {navGallery.name}
                  </Link>
                  {validSequence.nextPhoto ? (
                    <Link
                      href={`/photo/${validSequence.nextPhoto.slug}?fromGallery=${navGallery.slug}`}
                      className="flex items-center gap-2 justify-end text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <span className="truncate">
                        {validSequence.nextPhoto.title || 'Next photo'}
                      </span>
                      <span>→</span>
                    </Link>
                  ) : (
                    <span className="text-gray-300 flex items-center gap-2 justify-end">
                      <span>Last image</span><span>→</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 text-center mt-3">
                  Image {validSequence.position} of {validSequence.total}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        open={lightboxOpen}
        slides={slides}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
