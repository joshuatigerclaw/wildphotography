'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import VirtualizedGallery, { Photo as GalleryPhoto } from '@/components/VirtualizedGallery';
import GalleryLightboxModal, { LightboxPhoto } from '@/components/GalleryLightboxModal';

// ============================================================
// Props — matches the Photo type returned by getPhotosByGallery
// ============================================================

export interface GalleryClientPhoto {
  id: string;
  slug: string;
  title: string;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  largeUrl?: string | null;
  locationName?: string | null;
  region?: string | null;
  species_common_name?: string | null;
  keywords?: string | null;
}

interface GalleryClientProps {
  photos: GalleryClientPhoto[];
  gallerySlug: string;
  galleryName: string;
}

// ============================================================
// Component
// ============================================================

export default function GalleryClient({ photos, gallerySlug, galleryName }: GalleryClientProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollPosRef = useRef<number>(0);
  const baseGalleryUrl = `/gallery/${gallerySlug}`;

  // ── Map to the shape VirtualizedGallery expects ────────────

  const galleryPhotos: GalleryPhoto[] = photos.map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title || '',
    thumbUrl: p.thumbUrl,
    smallUrl: p.smallUrl,
    mediumUrl: p.mediumUrl,
    largeUrl: p.largeUrl,
    locationName: p.locationName,
    keywords: p.keywords,
  }));

  // ── Map to the shape GalleryLightboxModal expects ──────────
  // Use medium URL for modal display (large would be too slow)

  const lightboxPhotos: LightboxPhoto[] = photos.map(p => ({
    id: p.id,
    slug: p.slug,
    src: p.mediumUrl || p.smallUrl || p.thumbUrl || '',
    title: p.title || null,
    locationName: p.locationName || null,
    region: p.region || null,
    species_common_name: p.species_common_name || null,
  }));

  // ── Restore scroll position when modal closes ──────────────
  // useLayoutEffect fires synchronously after DOM update, before paint —
  // prevents the flash of a wrong scroll position.

  useLayoutEffect(() => {
    if (lightboxIndex === null && scrollPosRef.current > 0) {
      window.scrollTo(0, scrollPosRef.current);
    }
  }, [lightboxIndex]);

  // ── Open lightbox: save scroll, push ?photo= URL state ────

  const openLightbox = useCallback(
    (index: number) => {
      scrollPosRef.current = window.scrollY;
      const slug = photos[index]?.slug;
      if (slug) {
        window.history.pushState(
          { photoSlug: slug, photoIndex: index },
          '',
          `${baseGalleryUrl}?photo=${slug}`
        );
      }
      setLightboxIndex(index);
    },
    [photos, baseGalleryUrl]
  );

  // ── Close lightbox: push base gallery URL, clear state ────
  // pushState (not replaceState) so back-button returns to last photo.

  const closeLightbox = useCallback(() => {
    window.history.pushState({}, '', baseGalleryUrl);
    setLightboxIndex(null);
  }, [baseGalleryUrl]);

  // ── Called by modal when user navigates to a new image ─────
  // pushState for each navigation step so back steps through history.

  const handleIndexChange = useCallback(
    (newIndex: number, slug: string) => {
      window.history.pushState(
        { photoSlug: slug, photoIndex: newIndex },
        '',
        `${baseGalleryUrl}?photo=${slug}`
      );
    },
    [baseGalleryUrl]
  );

  // ── Browser back / forward (popstate) ─────────────────────
  // Reads ?photo= from the destination URL and syncs React state.
  // Closing via back-button sets lightboxIndex to null without a
  // new pushState — no duplicate history entry is created.

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const photoSlug = params.get('photo');
      if (photoSlug) {
        const index = photos.findIndex(p => p.slug === photoSlug);
        if (index !== -1) {
          setLightboxIndex(index);
        }
        // Invalid slug in URL — leave modal open at current position rather
        // than jarring the user; the bad param was pushed externally.
      } else {
        setLightboxIndex(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [photos]);

  // ── Auto-open from ?photo= on initial page load ────────────
  // Handles direct links, shared URLs, and page refresh while in modal.
  // Uses window.location (not useSearchParams) to avoid Suspense boundary.

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoSlug = params.get('photo');
    if (!photoSlug) return;

    const index = photos.findIndex(p => p.slug === photoSlug);
    if (index !== -1) {
      // Direct load — no previous scroll position to restore
      scrollPosRef.current = 0;
      setLightboxIndex(index);
    } else {
      // Unknown slug — silently strip the broken param from the URL
      window.history.replaceState({}, '', baseGalleryUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Photo click from gallery grid ─────────────────────────

  const handlePhotoClick = useCallback(
    (photo: GalleryPhoto) => {
      const index = photos.findIndex(p => p.id === photo.id);
      if (index !== -1) openLightbox(index);
    },
    [photos, openLightbox]
  );

  return (
    <>
      <VirtualizedGallery
        photos={galleryPhotos}
        columns={4}
        onPhotoClick={handlePhotoClick}
      />

      {lightboxIndex !== null && (
        <GalleryLightboxModal
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          gallerySlug={gallerySlug}
          galleryName={galleryName}
          onClose={closeLightbox}
          onIndexChange={handleIndexChange}
        />
      )}
    </>
  );
}
