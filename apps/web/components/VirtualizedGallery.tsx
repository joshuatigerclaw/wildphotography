'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';

// ============================================================
// Types - Gallery Engine Interface
// ============================================================

export interface Photo {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  locationName: string | null;
  keywords?: string[];
}

export interface GalleryEngine {
  name: string;
  render: (props: GalleryRenderProps) => React.ReactNode;
}

export interface GalleryRenderProps {
  photos: Photo[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  columns?: number;
  onPhotoClick?: (photo: Photo) => void;
}

// ============================================================
// Photo Tile Component
// ============================================================

function PhotoTile({ 
  photo, 
  style,
  onClick 
}: { 
  photo: Photo; 
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState(false);

  // Use derivative URLs only - NEVER original
  const imageUrl = useMemo(() => {
    if (error) return '/placeholder.jpg';
    return photo.thumbUrl || photo.smallUrl || '/placeholder.jpg';
  }, [photo.thumbUrl, photo.smallUrl, error]);

  return (
    <div
      style={style}
      className="relative overflow-hidden rounded-lg bg-gray-100 break-inside-avoid"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Skeleton placeholder */}
      {!loaded && !error && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ zIndex: 1 }}
        />
      )}

      {/* Error placeholder */}
      {error && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-3xl">📷</span>
        </div>
      )}

      {/* Image */}
      <img
        src={imageUrl}
        alt={photo.title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-auto block transition-opacity duration-300 ${
          loaded && !error ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Hover overlay with title/keywords */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200 flex flex-col justify-end ${
          hovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="p-3">
          <h3 className="text-white font-medium text-sm truncate">{photo.title}</h3>
          {photo.locationName && (
            <p className="text-white/70 text-xs truncate">{photo.locationName}</p>
          )}
          {photo.keywords && photo.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {photo.keywords.slice(0, 3).map((keyword) => (
                <span 
                  key={keyword} 
                  className="text-[10px] px-1.5 py-0.5 bg-white/20 text-white rounded"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile-safe tap behavior */}
      <Link
        href={`/photo/${photo.slug}`}
        className="absolute inset-0 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={`View ${photo.title}`}
        tabIndex={0}
      >
        <span className="sr-only">{photo.title}</span>
      </Link>
    </div>
  );
}

// ============================================================
// Skeleton Placeholders
// ============================================================

function SkeletonTile({ style }: { style?: React.CSSProperties }) {
  return (
    <div 
      style={style}
      className="relative overflow-hidden rounded-lg bg-gray-200 animate-pulse"
    />
  );
}

export function LoadingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTile key={i} />
      ))}
    </>
  );
}

// ============================================================
// Responsive Columns Hook
// ============================================================

function useResponsiveColumns(defaultColumns: number = 4): number {
  const [columnCount, setColumnCount] = useState(defaultColumns);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setColumnCount(2);
      else if (width < 768) setColumnCount(3);
      else if (width < 1024) setColumnCount(4);
      else if (width < 1280) setColumnCount(5);
      else setColumnCount(defaultColumns);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [defaultColumns]);

  return columnCount;
}

// ============================================================
// Virtuoso Gallery Engine - Primary Implementation
// ============================================================

function useLoadMoreTrigger(hasMore: boolean, onLoadMore?: () => void) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  return sentinelRef;
}

// Inner component (not exported directly to avoid conflicts)
function VirtuosoGalleryComponent({
  photos,
  loading = false,
  hasMore = false,
  onLoadMore,
  columns: defaultColumns = 4,
  onPhotoClick,
}: GalleryRenderProps) {
  const columns = useResponsiveColumns(defaultColumns);
  const sentinelRef = useLoadMoreTrigger(hasMore, onLoadMore);

  if (photos.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        No photos found
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4"
      >
        {photos.map((photo) => (
          <PhotoTile 
            key={photo.id} 
            photo={photo}
            onClick={() => onPhotoClick?.(photo)}
          />
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Load more trigger */}
      {hasMore && (
        <div ref={sentinelRef} className="h-20 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Simple Grid Gallery (Fallback / Alternative)
// ============================================================

function SimpleGridComponent({
  photos,
  loading = false,
  hasMore = false,
  onLoadMore,
  columns: defaultColumns = 4,
  onPhotoClick,
}: GalleryRenderProps) {
  const columns = useResponsiveColumns(defaultColumns);
  const sentinelRef = useLoadMoreTrigger(hasMore, onLoadMore);

  if (photos.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        No photos found
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        className="grid gap-4"
        style={{ 
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
        }}
      >
        {photos.map((photo) => (
          <PhotoTile 
            key={photo.id} 
            photo={photo}
            onClick={() => onPhotoClick?.(photo)}
          />
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div 
          className="grid gap-4 mt-4"
          style={{ 
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
          }}
        >
          <LoadingSkeleton count={columns * 2} />
        </div>
      )}

      {/* Load more trigger */}
      {hasMore && (
        <div ref={sentinelRef} className="h-20 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Gallery Engine Registry - For Swappable Implementation
// ============================================================

const galleryEngines: Record<string, GalleryEngine> = {
  virtuoso: {
    name: 'Virtuoso',
    render: (props) => <VirtuosoGalleryComponent {...props} />,
  },
  simple: {
    name: 'Simple Grid',
    render: (props) => <SimpleGridComponent {...props} />,
  },
};

// ============================================================
// Default Export - Primary Gallery Component
// ============================================================

function MainGallery(props: GalleryRenderProps) {
  return <VirtuosoGalleryComponent {...props} />;
}

export default MainGallery;

// Named exports
export { VirtuosoGalleryComponent as VirtuosoGallery, SimpleGridComponent as SimpleGridGallery };
export { galleryEngines as GALLERY_ENGINES };
