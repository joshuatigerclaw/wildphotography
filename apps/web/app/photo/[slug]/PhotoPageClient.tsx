'use client';

import { useState } from 'react';
import Link from 'next/link';
import ResponsiveImage from '../../../components/ResponsiveImage';
import PhotoLightbox from '../../../components/PhotoLightbox';
import ExifDisplay from '../../../components/ExifDisplay';
import KeywordChips from '../../../components/KeywordChips';
import RelatedPhotos from '../../../components/RelatedPhotos';

interface PhotoData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  longDescription?: string;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  largeUrl?: string | null;
  locationName?: string | null;
  keywords?: string[];
  gallerySlug?: string;
  galleryName?: string;
  exif?: {
    camera?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: string;
    dateTaken?: string;
    dimensions?: string;
  };
}

interface PhotoPageClientProps {
  photo: PhotoData;
  lightboxSlides: Array<{
    id: string;
    src: string;
    alt: string;
    title?: string;
  }>;
  relatedPhotos: PhotoData[];
}

export default function PhotoPageClient({ photo, lightboxSlides, relatedPhotos }: PhotoPageClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        {photo.gallerySlug && (
          <>
            <Link href={`/gallery/${photo.gallerySlug}`} className="text-blue-600 hover:underline">
              {photo.galleryName}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-gray-600">{photo.title}</span>
      </nav>

      {/* Main photo with lightbox */}
      <div className="mb-8">
        <div 
          className="cursor-zoom-in"
          onClick={() => setLightboxOpen(true)}
        >
          <ResponsiveImage
            src={photo.mediumUrl || photo.largeUrl || photo.smallUrl || '/placeholder.jpg'}
            alt={photo.title}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
            className="rounded-lg"
          />
        </div>
        
        {/* Lightbox */}
        <PhotoLightbox
          open={lightboxOpen}
          slides={lightboxSlides}
          onClose={() => setLightboxOpen(false)}
        />
      </div>

      {/* Photo details */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Left column - Main info */}
        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold mb-4">{photo.title}</h1>
          
          {photo.locationName && (
            <p className="text-lg text-gray-600 mb-4">
              📍 {photo.locationName}
            </p>
          )}

          {photo.longDescription && (
            <div className="prose max-w-none mb-8">
              <p className="text-gray-700 leading-relaxed">{photo.longDescription}</p>
            </div>
          )}

          {/* Keywords */}
          {photo.keywords && photo.keywords.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Keywords</h2>
              <KeywordChips keywords={photo.keywords} />
            </div>
          )}

          {/* Related Photos */}
          <div className="mt-12">
            <RelatedPhotos 
              photos={relatedPhotos.map(p => ({
                id: p.id,
                slug: p.slug,
                title: p.title,
                thumbUrl: p.thumbUrl,
              }))} 
            />
          </div>
        </div>

        {/* Right column - Sidebar */}
        <div>
          {/* Buy/Download button placeholder */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Purchase</h3>
            <div className="space-y-3">
              <button 
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                disabled
                title="Coming soon"
              >
                Buy Print ($49)
              </button>
              <button 
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                disabled
                title="Coming soon"
              >
                Download ($29)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Purchasing options coming soon
            </p>
          </div>

          {/* EXIF Data */}
          <div className="mb-6">
            <ExifDisplay exif={photo.exif} />
          </div>

          {/* Share */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Share</h3>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm">
                Facebook
              </button>
              <button className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition text-sm">
                X
              </button>
              <button className="flex-1 px-4 py-2 bg-blue-400 text-white rounded hover:bg-blue-500 transition text-sm">
                Pinterest
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
