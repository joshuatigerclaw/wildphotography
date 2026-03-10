'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PhotoLightbox, PhotoSlide } from '@/components/PhotoLightbox';
import LocationMap from '@/components/LocationMap';
import VirtualizedGallery from '@/components/VirtualizedGallery';

interface PhotoData {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  description_long?: string | null;
  keywords?: string | null;
  locationName?: string | null;
  width?: number | null;
  height?: number | null;
  camera_make?: string | null;
  camera_model?: string | null;
  lens?: string | null;
  iso?: number | null;
  aperture?: string | null;
  shutter_speed?: string | null;
  focal_length_mm?: number | null;
  lat?: number | null;
  lon?: number | null;
  views_count?: number | null;
  date_taken?: string | null;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  largeUrl?: string | null;
}

interface RelatedPhoto {
  id: string;
  slug: string;
  title: string;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  keywords?: string | null;
}

interface PhotoPageClientProps {
  photo: PhotoData;
  relatedPhotos?: RelatedPhoto[];
}

export default function PhotoPageClient({ photo, relatedPhotos = [] }: PhotoPageClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExif, setShowExif] = useState(false);

  // Record visit on mount
  useEffect(() => {
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id, slug: photo.slug }),
    }).catch(console.error);
  }, [photo.id, photo.slug]);

  // Build slides for lightbox
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

  const handlePurchase = async () => {
    setPurchasing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/paypal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: parseInt(photo.id) }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing(false);
    }
  };

  // Parse keywords into array
  const keywordsArray = photo.keywords 
    ? photo.keywords.split(',').map(k => k.trim()).filter(Boolean)
    : [];

  // Has valid coordinates for map
  const hasLocation = photo.lat && photo.lon && photo.lat !== 0 && photo.lon !== 0;

  // Format technical details
  const exifDetails = [
    photo.width && photo.height && { label: 'Dimensions', value: `${photo.width} × ${photo.height}` },
    photo.camera_make && { label: 'Camera', value: [photo.camera_make, photo.camera_model].filter(Boolean).join(' ') },
    photo.lens && { label: 'Lens', value: photo.lens },
    photo.focal_length_mm && { label: 'Focal Length', value: `${photo.focal_length_mm}mm` },
    photo.aperture && { label: 'Aperture', value: photo.aperture },
    photo.shutter_speed && { label: 'Shutter', value: photo.shutter_speed },
    photo.iso && { label: 'ISO', value: photo.iso.toString() },
    photo.date_taken && { label: 'Taken', value: new Date(photo.date_taken).toLocaleDateString() },
  ].filter(Boolean);

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm mb-6">
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">{photo.title}</span>
        </nav>

        {/* Main Photo */}
        <div className="mb-10">
          <div 
            className="cursor-zoom-in rounded-2xl overflow-hidden shadow-2xl"
            onClick={() => openLightbox(0)}
          >
            {photo.mediumUrl && (
              <img
                src={photo.mediumUrl}
                alt={photo.title || ''}
                className="w-full h-auto rounded-2xl"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px"
                loading="eager"
              />
            )}
            <p className="text-center text-sm text-gray-500 mt-4">
              🖱️ Click to view fullscreen
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Left Column - Photo Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Description */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">{photo.title}</h1>
              
              {(photo.description_long || photo.description) && (
                <p className="text-gray-700 text-lg leading-relaxed">
                  {photo.description_long || photo.description}
                </p>
              )}
            </div>

            {/* Keywords */}
            {keywordsArray.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Keywords</h2>
                <div className="flex flex-wrap gap-2">
                  {keywordsArray.map((keyword) => (
                    <Link
                      key={keyword}
                      href={`/search?q=${encodeURIComponent(keyword)}`}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200 shadow-sm"
                    >
                      {keyword}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Location Map */}
            {hasLocation && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Location</h2>
                <LocationMap 
                  lat={photo.lat!} 
                  lon={photo.lon!} 
                  locationName={photo.locationName || 'Costa Rica'}
                />
              </div>
            )}

            {/* Related Photos */}
            {relatedPhotos.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Related Photos</h2>
                <VirtualizedGallery
                  photos={relatedPhotos.map(p => ({
                    ...p,
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Technical Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <button 
                onClick={() => setShowExif(!showExif)}
                className="w-full flex justify-between items-center mb-4"
              >
                <h3 className="text-lg font-semibold">📷 Technical Details</h3>
                <span className="text-gray-400">{showExif ? '▲' : '▼'}</span>
              </button>
              
              {showExif && (
                <div className="space-y-2">
                  {exifDetails.map((detail: any, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-500">{detail.label}</span>
                      <span className="font-medium">{detail.value}</span>
                    </div>
                  ))}
                  {exifDetails.length === 0 && (
                    <p className="text-gray-400 text-sm">No technical details available</p>
                  )}
                </div>
              )}
              
              {photo.views_count !== null && photo.views_count !== undefined && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">{photo.views_count}</span> views
                  </p>
                </div>
              )}
            </div>

            {/* Purchase Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl">
              <h3 className="text-xl font-semibold mb-4">Purchase</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 text-red-200 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-3">
                <button 
                  className="w-full px-6 py-4 bg-gray-600 text-gray-400 font-semibold rounded-xl cursor-not-allowed"
                  disabled
                >
                  🖼️ Print (Coming Soon)
                </button>
                <button 
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {purchasing ? '⏳ Processing...' : '💾 Download High-Res — $29'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                🔒 Secure payment via PayPal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        open={lightboxOpen}
        slides={slides}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
