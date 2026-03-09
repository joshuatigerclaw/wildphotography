'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PhotoLightbox, PhotoSlide } from '@/components/PhotoLightbox';

interface PhotoData {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  locationName?: string | null;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  largeUrl?: string | null;
  previewUrl?: string | null;
  keywords?: (string | null)[];
}

interface PhotoPageClientProps {
  photo: PhotoData;
}

export default function PhotoPageClient({ photo }: PhotoPageClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Build slides for lightbox - use derivative URLs ONLY
  const slides: PhotoSlide[] = [
    {
      id: photo.id,
      src: photo.largeUrl || photo.mediumUrl || photo.smallUrl || '',
      alt: photo.title || '',
      title: photo.title,
    },
  ].filter(s => s.src);

  const openLightbox = (index: number = 0) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <nav className="text-sm mb-6">
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">{photo.title}</span>
        </nav>

        <div className="mb-8">
          {/* Main image with lightbox trigger */}
          <div 
            className="cursor-zoom-in rounded-lg overflow-hidden"
            onClick={() => openLightbox(0)}
          >
            {photo.mediumUrl && (
              <img
                src={photo.mediumUrl}
                alt={photo.title || ''}
                className="w-full h-auto rounded-lg"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              />
            )}
            <p className="text-center text-sm text-gray-500 mt-2">
              Click to view fullscreen
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h1 className="text-4xl font-bold mb-4">{photo.title}</h1>
            
            {photo.locationName && (
              <p className="text-lg text-gray-600 mb-4">📍 {photo.locationName}</p>
            )}

            {photo.description && (
              <p className="text-gray-700 leading-relaxed mb-8">{photo.description}</p>
            )}

            {photo.keywords && photo.keywords.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3">Keywords</h2>
                <div className="flex flex-wrap gap-2">
                  {photo.keywords.filter(Boolean).map((keyword) => (
                    <span 
                      key={keyword} 
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Purchase</h3>
              <div className="space-y-3">
                <button className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition" disabled>
                  Buy Print ($49)
                </button>
                <button className="w-full px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition" disabled>
                  Download ($29)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">Coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for fullscreen viewing */}
      <PhotoLightbox
        open={lightboxOpen}
        slides={slides}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
