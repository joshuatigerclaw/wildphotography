'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

export interface Photo {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  locationName: string | null;
}

export interface MasonryGridProps {
  photos: Photo[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  columns?: number;
}

function PhotoTile({ photo }: { photo: Photo }) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState(false);

  // Use smallest available derivative - NEVER original
  const imageUrl = !error 
    ? (photo.thumbUrl || photo.smallUrl || '/placeholder.jpg') 
    : '/placeholder.jpg';

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-gray-100 break-inside-avoid"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
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

      {/* Hover overlay */}
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
        </div>
      </div>

      {/* Tap/click target */}
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

function LoadingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-lg bg-gray-200 animate-pulse aspect-[3/4]"
        />
      ))}
    </>
  );
}

export function MasonryGrid({
  photos,
  loading = false,
  hasMore = false,
  onLoadMore,
  columns = 4,
}: MasonryGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || !onLoadMore || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  // Responsive columns
  const getColumns = useCallback(() => {
    if (typeof window === 'undefined') return columns;
    if (window.innerWidth < 640) return 2;
    if (window.innerWidth < 768) return 3;
    if (window.innerWidth < 1024) return 4;
    return columns;
  }, [columns]);

  const [columnCount, setColumnCount] = useState(columns);

  useEffect(() => {
    const handleResize = () => setColumnCount(getColumns());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getColumns]);

  // Distribute photos into columns for masonry effect
  const distributedPhotos = useCallback(() => {
    const cols: Photo[][] = Array.from({ length: columnCount }, () => []);
    photos.forEach((photo, i) => {
      cols[i % columnCount].push(photo);
    });
    return cols;
  }, [photos, columnCount]);

  return (
    <div className="w-full">
      {photos.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-500">
          No photos found
        </div>
      ) : (
        <div 
          className="columns-2 sm:columns-3 md:columns-4 gap-4 space-y-4"
          style={{ columnCount }}
        >
          {photos.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} />
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
}

export default MasonryGrid;
