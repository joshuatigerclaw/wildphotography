'use client';

import Link from 'next/link';
import { Photo as GalleryPhoto } from '@/components/VirtualizedGallery';

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

export default function GalleryClient({ photos, gallerySlug }: GalleryClientProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
      {photos.map((photo) => (
        <Link
          key={photo.id}
          href={`/photo/${photo.slug}`}
          style={{ display: 'block', textDecoration: 'none' }}
        >
          <div
            style={{
              aspectRatio: '1/1',
              background: 'var(--bg-inset)',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              border: '1px solid var(--rule)',
            }}
          >
            {photo.thumbUrl ? (
              <img
                src={photo.thumbUrl}
                alt={photo.title}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)', fontSize: '28px' }}>📷</div>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', margin: '8px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {photo.title}
          </p>
          {photo.locationName && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-dim)', margin: 0 }}>
              {photo.locationName}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
