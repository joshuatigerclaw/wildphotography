'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PhotoLightbox, PhotoSlide } from '@/components/PhotoLightbox';

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
  camera_model?: string | null;
  lat?: number | null;
  lon?: number | null;
  views_count?: number | null;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  largeUrl?: string | null;
  previewUrl?: string | null;
}

interface PhotoPageClientProps {
  photo: PhotoData;
}

export default function PhotoPageClient({ photo }: PhotoPageClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Record visit on mount
  useEffect(() => {
    // Record visit via API
    fetch('/api/v1/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id, slug: photo.slug }),
    }).catch(console.error);
  }, [photo.id, photo.slug]);

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

  const handlePurchase = async () => {
    setPurchasing(true);
    setError(null);
    
    try {
      // Create checkout
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
      
      // Redirect to PayPal
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
            className="cursor-zoom-in rounded-xl overflow-hidden shadow-lg"
            onClick={() => openLightbox(0)}
          >
            {photo.mediumUrl && (
              <img
                src={photo.mediumUrl}
                alt={photo.title || ''}
                className="w-full h-auto rounded-xl"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              />
            )}
            <p className="text-center text-sm text-gray-500 mt-3">
              Click to view fullscreen
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            <h1 className="text-4xl font-bold mb-4">{photo.title}</h1>
            
            {photo.description_long || photo.description ? (
              <p className="text-gray-700 leading-relaxed mb-6 text-lg">
                {photo.description_long || photo.description}
              </p>
            ) : null}

            {/* Keywords as clickable chips */}
            {keywordsArray.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Keywords</h2>
                <div className="flex flex-wrap gap-2">
                  {keywordsArray.map((keyword) => (
                    <Link
                      key={keyword}
                      href={`/search?q=${encodeURIComponent(keyword)}`}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200"
                    >
                      {keyword}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Location Map */}
            {hasLocation && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Location</h2>
                <div className="rounded-xl overflow-hidden shadow-md">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${photo.lat},${photo.lon}&zoom=10&size=600x300&markers=${photo.lat},${photo.lon}&key=AIzaSyDlPfxC2naf0Ifc_tH4HTLQoKJZ60fi0fo`}
                    alt="Location map"
                    className="w-full h-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                {photo.locationName && (
                  <p className="text-gray-600 mt-2">📍 {photo.locationName}</p>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {photo.width && photo.height && (
                <p className="text-sm text-gray-600"><span className="font-medium">Dimensions:</span> {photo.width} × {photo.height}</p>
              )}
              {photo.camera_model && (
                <p className="text-sm text-gray-600"><span className="font-medium">Camera:</span> {photo.camera_model}</p>
              )}
              {photo.views_count && (
                <p className="text-sm text-gray-500"><span className="font-medium">Views:</span> {photo.views_count}</p>
              )}
            </div>
          </div>

          <div>
            <div className="bg-gray-50 rounded-xl p-6 sticky top-24">
              <h3 className="text-xl font-semibold mb-4">Purchase</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-3">
                <button 
                  className="w-full px-6 py-4 bg-gray-300 text-gray-500 font-semibold rounded-lg cursor-not-allowed"
                  disabled
                >
                  Buy Print (Coming Soon)
                </button>
                <button 
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 shadow-md"
                >
                  {purchasing ? 'Processing...' : 'Download High-Res — $29'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                🔒 Secure payment via PayPal
              </p>
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
