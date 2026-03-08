'use client';

import { useState, useCallback } from 'react';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  onClick?: () => void;
}

interface ImageVariants {
  thumb?: string;
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}

export function ResponsiveImage({
  src,
  alt,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  className = '',
  priority = false,
  onClick,
}: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => setError(true), []);

  if (error) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="text-4xl">📷</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Skeleton placeholder */}
      {!loaded && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse z-10"
          style={{ 
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.3
          }}
        />
      )}
      
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        className={`w-full h-auto block transition-opacity duration-300 cursor-pointer ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${onClick ? 'hover:opacity-95' : ''}`}
      />
    </div>
  );
}

// Helper to build srcset from variants
export function buildSrcSet(variants: ImageVariants): string {
  const sources: string[] = [];
  
  if (variants.small) sources.push(`${variants.small} 400w`);
  if (variants.medium) sources.push(`${variants.medium} 800w`);
  if (variants.large) sources.push(`${variants.large} 1200w`);
  
  return sources.join(', ');
}

export default ResponsiveImage;
