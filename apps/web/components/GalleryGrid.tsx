'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';

export interface Photo {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  locationName: string | null;
}

export interface GalleryGridProps {
  photos: Photo[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  columns?: number;
}

function PhotoCard({ photo, columns }: { photo: Photo; columns: number }) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const imageUrl = photo.thumbUrl || photo.smallUrl || '/placeholder.jpg';
  const aspectRatio = 1; // Square tiles for consistent grid

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-gray-100"
      style={{ aspectRatio: '1' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Skeleton placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      {/* Image */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt={photo.title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Hover overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200 ${
          hovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-medium text-sm truncate">{photo.title}</h3>
          {photo.locationName && (
            <p className="text-white/70 text-xs truncate">{photo.locationName}</p>
          )}
        </div>
      </div>

      {/* Link wrapper for SEO and accessibility */}
      <Link
        href={`/photo/${photo.slug}`}
        className="absolute inset-0 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={`View ${photo.title}`}
      >
        <span className="sr-only">{photo.title}</span>
      </Link>
    </div>
  );
}

function PhotoCardSkeleton({ columns }: { columns: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-lg bg-gray-100 animate-pulse"
      style={{ aspectRatio: '1' }}
    >
      <div className="absolute inset-0 bg-gray-200" />
    </div>
  );
}

export function GalleryGrid({
  photos,
  loading = false,
  hasMore = false,
  onLoadMore,
  columns = 4,
}: GalleryGridProps) {
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive column calculation
  const getColumns = useCallback(() => {
    if (typeof window === 'undefined') return columns;
    if (window.innerWidth < 640) return 2;
    if (window.innerWidth < 768) return 3;
    if (window.innerWidth < 1024) return 4;
    return columns;
  }, [columns]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const currentColumns = getColumns();
  const tileWidth = Math.floor((containerWidth - (currentColumns - 1) * 16) / currentColumns);

  // Use VirtuosoGrid for efficient virtualization
  return (
    <div ref={containerRef} className="w-full">
      {photos.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-500">
          No photos found
        </div>
      ) : (
        <VirtuosoGrid
          useWindowScroll
          totalCount={photos.length}
          overscan={200}
          listClassName="grid gap-4"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${currentColumns}, 1fr)`,
            gap: '16px',
          }}
          itemContent={(index) => (
            <PhotoCard
              photo={photos[index]}
              columns={currentColumns}
            />
          )}
        />
      )}

      {/* Load more trigger */}
      {hasMore && (
        <div ref={(el) => {
          if (el && onLoadMore) {
            const observer = new IntersectionObserver(
              ([entry]) => {
                if (entry.isIntersecting) {
                  onLoadMore();
                }
              },
              { rootMargin: '200px' }
            );
            observer.observe(el);
          }
        }} className="h-20 flex items-center justify-center">
          {loading && <PhotoCardSkeleton columns={currentColumns} />}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && photos.length === 0 && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${currentColumns}, 1fr)` }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <PhotoCardSkeleton key={i} columns={currentColumns} />
          ))}
        </div>
      )}
    </div>
  );
}

export default GalleryGrid;
