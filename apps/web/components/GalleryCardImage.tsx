'use client';

import { useState } from 'react';

interface GalleryCardImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

export function GalleryCardImage({ src, alt, className, style }: GalleryCardImageProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      style={{
        ...style,
        transform: isHovered ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform var(--t-med)',
      }}
      loading="lazy"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={className}
    />
  );
}