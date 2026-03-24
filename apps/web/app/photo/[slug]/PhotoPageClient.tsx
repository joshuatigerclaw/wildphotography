'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PhotoLightbox, PhotoSlide } from '@/components/PhotoLightbox';
import LocationMap from '@/components/LocationMap';
import VirtualizedGallery from '@/components/VirtualizedGallery';
import { getDisplayTitle, looksLikeFilename } from '@/lib/titles';

interface PhotoData {
  id: string;
  slug: string;
  title: string | null;
  description?: string | null;
  description_long?: string | null;
  keywords?: string | null;
  locationName?: string | null;
  country?: string | null;
  region?: string | null;
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
  title: string | null;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  keywords?: string | null;
}

interface GalleryContext {
  slug: string;
  name: string;
}

interface PhotoPageClientProps {
  photo: PhotoData;
  relatedPhotos?: RelatedPhoto[];
  galleryPhotos?: RelatedPhoto[];
  gallery?: GalleryContext | null;
}

export default function PhotoPageClient({ 
  photo, 
  relatedPhotos = [], 
  galleryPhotos = [],
  gallery 
}: PhotoPageClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExif, setShowExif] = useState(false);
  
  const searchParams = useSearchParams();
  const fromGallery = searchParams.get('from');
  
  // Get display title with proper fallback logic
  const displayTitle = useMemo(() => {
    const title = getDisplayTitle(photo.title);
    // If title looks like a filename, we'll show contextual info instead
    const isUgly = !title || looksLikeFilename(title);
    return { title, isUgly };
  }, [photo.title]);
  
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
      alt: displayTitle.title || 'Photo',
      title: displayTitle.title,
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

  // Back link - prefer gallery context or fall back
  const backLink = gallery ? `/gallery/${gallery.slug}` : '/galleries';

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="text-sm mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 flex-wrap">
            <li>
              <Link href="/" className="text-blue-600 hover:underline">Home</Link>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <Link href="/galleries" className="text-blue-600 hover:underline">Galleries</Link>
            </li>
            {gallery && (
              <>
                <li className="text-gray-400">/</li>
                <li>
                  <Link href={`/gallery/${gallery.slug}`} className="text-blue-600 hover:underline">
                    {gallery.name}
                  </Link>
                </li>
              </>
            )}
            <li className="text-gray-400">/</li>
            <li className="text-gray-600 truncate max-w-[200px]" aria-current="page">
              {displayTitle.title || 'Photo'}
            </li>
          </ol>
        </nav>

        {/* Back to Gallery Button */}
        <div className="mb-4">
          <Link 
            href={backLink}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
          >
            <span>←</span>
            <span>Back to {gallery?.name || 'Gallery'}</span>
          </Link>
        </div>

        {/* Main Photo */}
        <div className="mb-8">
          <div 
            className="cursor-zoom-in rounded-xl overflow-hidden shadow-2xl"
            onClick={() => openLightbox(0)}
          >
            {photo.mediumUrl && (
              <img
                src={photo.mediumUrl}
                alt={displayTitle.title || 'Photo'}
                className="w-full h-auto rounded-xl"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px"
                loading="eager"
              />
            )}
            <p className="text-center text-sm text-gray-500 mt-3">
              Click to view fullscreen
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Photo Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Description - Premium Editorial Style */}
            <div className="border-b pb-6">
              {/* Gallery badge */}
              {gallery && (
                <Link 
                  href={`/gallery/${gallery.slug}`}
                  className="inline-block text-xs font-semibold uppercase tracking-wider text-blue-600 hover:text-blue-800 mb-2"
                >
                  {gallery.name}
                </Link>
              )}
              
              {/* Title */}
              {displayTitle.isUgly ? (
                // Show contextual label instead of ugly filename
                <div>
                  {photo.locationName && (
                    <p className="text-xl font-medium text-gray-700">
                      📍 {photo.locationName}
                    </p>
                  )}
                  {!photo.locationName && gallery && (
                    <p className="text-xl font-medium text-gray-700">
                      From {gallery.name}
                    </p>
                  )}
                </div>
              ) : (
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  {displayTitle.title}
                </h1>
              )}
              
              {/* Description */}
              {(photo.description_long || photo.description) && (
                <p className="text-gray-700 text-lg leading-relaxed">
                  {photo.description_long || photo.description}
                </p>
              )}
              
              {/* Location line if no main title */}
              {displayTitle.isUgly && photo.locationName && (
                <p className="text-gray-600 mt-2">
                  Location: {photo.locationName}
                  {photo.country && `, ${photo.country}`}
                </p>
              )}
            </div>

            {/* Keywords */}
            {keywordsArray.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Keywords</h2>
                <div className="flex flex-wrap gap-2">
                  {keywordsArray.map((keyword) => (
                    <Link
                      key={keyword}
                      href={`/search?q=${encodeURIComponent(keyword)}`}
                      className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200"
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
                <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Location</h2>
                <LocationMap 
                  lat={photo.lat!} 
                  lon={photo.lon!} 
                  locationName={photo.locationName || 'Costa Rica'}
                />
              </div>
            )}

            {/* More From This Gallery */}
            {galleryPhotos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                  More from {gallery?.name || 'this gallery'}
                </h2>
                <VirtualizedGallery
                  photos={galleryPhotos.map(p => ({
                    ...p,
                    title: p.title || 'Photo',
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
              </div>
            )}

            {/* Related Photos */}
            {relatedPhotos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Related Photos</h2>
                <VirtualizedGallery
                  photos={relatedPhotos.map(p => ({
                    ...p,
                    title: p.title || 'Photo',
                    thumbUrl: p.smallUrl || p.thumbUrl,
                  }))}
                  columns={4}
                />
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-5">
            {/* Technical Details Card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <button 
                onClick={() => setShowExif(!showExif)}
                className="w-full flex justify-between items-center mb-3"
              >
                <h3 className="text-base font-semibold">Technical Details</h3>
                <span className="text-gray-400">{showExif ? '−' : '+'}</span>
              </button>
              
              {showExif && (
                <div className="space-y-2 text-sm">
                  {exifDetails.map((detail: any, i) => (
                    <div key={i} className="flex justify-between">
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
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">{photo.views_count}</span> views
                  </p>
                </div>
              )}
            </div>

            {/* Purchase Card */}
            <div className="bg-gray-900 rounded-xl p-5 text-white shadow-lg">
              <h3 className="text-lg font-semibold mb-3">Purchase</h3>
              
              {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-200 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <button 
                  className="w-full px-4 py-3 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
                  disabled
                >
                  Print (Coming Soon)
                </button>
                <button 
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {purchasing ? 'Processing...' : 'Download High-Res — $29'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                Secure payment via PayPal
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
