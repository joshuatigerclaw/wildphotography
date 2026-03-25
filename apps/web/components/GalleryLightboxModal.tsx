'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { looksLikeFilename } from '@/lib/titles';

// ============================================================
// Types
// ============================================================

export interface LightboxPhoto {
  id: string;
  slug: string;
  /** URL for the main display image — use medium or large derivative */
  src: string;
  title?: string | null;
  locationName?: string | null;
  region?: string | null;
  species_common_name?: string | null;
}

interface GalleryLightboxModalProps {
  photos: LightboxPhoto[];
  initialIndex: number;
  gallerySlug: string;
  galleryName: string;
  onClose: () => void;
  /** Called when the displayed image changes — skips the initial mount render */
  onIndexChange?: (index: number, slug: string) => void;
}

// ============================================================
// Icons (inline SVG — no emoji)
// ============================================================

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconArrow = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

// ============================================================
// Main Component
// ============================================================

export default function GalleryLightboxModal({
  photos,
  initialIndex,
  gallerySlug,
  galleryName,
  onClose,
  onIndexChange,
}: GalleryLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);

  const total = photos.length;
  const current = photos[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;
  const prevPhoto = hasPrev ? photos[currentIndex - 1] : null;
  const nextPhoto = hasNext ? photos[currentIndex + 1] : null;

  // ── Navigation ─────────────────────────────────────────────

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setImageLoaded(false);
      setCurrentIndex(i => i - 1);
    }
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) {
      setImageLoaded(false);
      setCurrentIndex(i => i + 1);
    }
  }, [hasNext]);

  // ── Notify parent when index changes (skip initial mount) ──

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const slug = photos[currentIndex]?.slug;
    if (slug) onIndexChange?.(currentIndex, slug);
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Copy shareable link to clipboard ──────────────────────

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API unavailable — silently skip
    });
  }, []);

  // ── Keyboard ───────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose]);

  // ── Body scroll lock + initial focus ──────────────────────

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Short delay so the modal is painted before focus moves
    const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Preload adjacent images ────────────────────────────────

  useEffect(() => {
    if (prevPhoto?.src) {
      const img = new Image();
      img.src = prevPhoto.src;
    }
    if (nextPhoto?.src) {
      const img = new Image();
      img.src = nextPhoto.src;
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset loaded state when photo changes
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  // ── Touch / Swipe ──────────────────────────────────────────

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      dx < 0 ? goNext() : goPrev();
    }
    touchStartX.current = null;
  };

  // ── Metadata ───────────────────────────────────────────────

  const metaItems = [
    { label: 'Gallery', value: galleryName, href: `/gallery/${gallerySlug}` },
    current?.locationName && { label: 'Location', value: current.locationName },
    current?.region && { label: 'Region', value: current.region },
    current?.species_common_name && { label: 'Species', value: current.species_common_name },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  const hasTravel = !!(current?.locationName || current?.region || current?.species_common_name);

  const ctaText = current?.locationName
    ? `Explore tours near ${current.locationName}`
    : current?.species_common_name
    ? 'See wildlife experiences nearby'
    : current?.region
    ? `Explore tours in ${current.region}`
    : null;

  const ctaQuery = encodeURIComponent(
    (current?.locationName || current?.region || 'Costa Rica') + ' tours'
  );

  const showTitle = current?.title && !looksLikeFilename(current.title);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Gallery photo viewer"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Top bar: position counter + close ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/50 text-sm select-none">
          Image {currentIndex + 1} of {total}
        </span>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close viewer"
          className="text-white/70 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
        >
          <IconClose />
        </button>
      </div>

      {/* ── Image area ── */}
      <div className="relative flex-1 flex items-center justify-center min-h-0 px-14 sm:px-20 overflow-hidden">

        {/* Previous button */}
        <button
          onClick={goPrev}
          disabled={!hasPrev}
          aria-label="Previous photo"
          className={`absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all select-none ${
            hasPrev
              ? 'text-white/80 hover:text-white hover:bg-white/10 cursor-pointer'
              : 'text-white/15 cursor-not-allowed'
          }`}
        >
          <IconChevronLeft />
        </button>

        {/* Main image */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Spinner shown while loading */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}
          <img
            key={current.id}
            src={current.src}
            alt={showTitle ? current.title! : (current.locationName || 'Photo')}
            onLoad={() => setImageLoaded(true)}
            className={`max-h-full max-w-full object-contain transition-opacity duration-200 select-none ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            draggable={false}
          />
        </div>

        {/* Next button */}
        <button
          onClick={goNext}
          disabled={!hasNext}
          aria-label="Next photo"
          className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all select-none ${
            hasNext
              ? 'text-white/80 hover:text-white hover:bg-white/10 cursor-pointer'
              : 'text-white/15 cursor-not-allowed'
          }`}
        >
          <IconChevronRight />
        </button>
      </div>

      {/* ── Bottom panel: title, metadata, actions ── */}
      <div className="shrink-0 border-t border-white/10 px-4 pb-5 pt-3 max-w-3xl mx-auto w-full">

        {/* Title */}
        {showTitle && (
          <p className="text-white font-semibold text-sm sm:text-base mb-2 truncate">
            {current.title}
          </p>
        )}

        {/* Metadata row */}
        {metaItems.length > 0 && (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-3">
            {metaItems.map(({ label, value, href }) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt className="text-white/40 text-xs uppercase tracking-wider shrink-0">{label}</dt>
                <dd className="text-white/80 font-medium truncate">
                  {href ? (
                    <a
                      href={href}
                      className="hover:text-white hover:underline transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-4">
          {/* View full photo page */}
          <Link
            href={`/photo/${current.slug}?fromGallery=${gallerySlug}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
            onClick={e => e.stopPropagation()}
          >
            View photo details
            <IconArrow />
          </Link>

          {/* Copy shareable link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <IconLink />
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {/* Compact contextual CTA — suppressed when no travel context */}
          {hasTravel && ctaText && (
            <a
              href={`https://www.getyourguide.com/s/?q=${ctaQuery}&partner_id=WILD`}
              target="_blank"
              rel="noopener sponsored"
              className="text-xs text-white/45 hover:text-white/75 border border-white/15 rounded-full px-3 py-1 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              {ctaText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
