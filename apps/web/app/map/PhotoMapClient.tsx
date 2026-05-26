'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const R2_PUBLIC = 'https://images.wildphotography.com';

type MapPhoto = {
  id: string;
  slug: string;
  title: string | null;
  thumbUrl: string | null;
  lat: number;
  lon: number;
  locationName: string | null;
  galleryName: string | null;
  gallerySlug: string | null;
};

function withR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

export default function PhotoMapClient({ photos }: { photos: MapPhoto[] }) {
  const [selectedPhoto, setSelectedPhoto] = useState<MapPhoto | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([10.0, -84.0]); // Costa Rica center

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No geotagged photos found.</p>
        <p className="text-sm mt-2">Photos with GPS coordinates will appear on the map.</p>
      </div>
    );
  }

  // Build map center from first photo
  const firstPhoto = photos[0];
  const centerLat = firstPhoto?.lat || 10.0;
  const centerLon = firstPhoto?.lon || -84.0;

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${centerLon - 3},${centerLat - 2},${centerLon + 3},${centerLat + 2}&layer=mapnik`;

  return (
    <div className="space-y-6">

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="font-medium text-gray-700">{photos.length} geotagged photos</span>
        <span>·</span>
        <span>Click any photo to preview</span>
      </div>

      {/* Map embed */}
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
        <iframe
          width="100%"
          height="500"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={embedUrl}
          style={{ border: 'none' }}
          title="Interactive Costa Rica Photo Map"
        />
      </div>

      <div className="text-xs text-gray-400">
        <a
          href={`https://www.openstreetmap.org/#map=7/${centerLat}/${centerLon}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-600"
        >
          View full map on OpenStreetMap ↗
        </a>
      </div>

      {/* Photo grid below map */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          All Geotagged Photos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {photos.map(photo => {
            const src = withR2(photo.thumbUrl);
            return (
              <div
                key={photo.id}
                className="group relative cursor-pointer rounded-xl overflow-hidden bg-gray-100 border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all"
                onClick={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
              >
                {src ? (
                  <img
                    src={src}
                    alt={photo.title || photo.slug}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-square bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-2xl">◻</span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-white text-xs font-medium leading-tight line-clamp-2">
                    {photo.title || photo.slug}
                  </p>
                  {photo.locationName && (
                    <p className="text-white/70 text-[10px] mt-0.5">{photo.locationName}</p>
                  )}
                </div>

                {/* Coordinate badge */}
                <div className="absolute top-1 right-1 bg-black/50 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  {photo.lat.toFixed(3)}, {photo.lon.toFixed(3)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Photo detail panel */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="relative">
              {withR2(selectedPhoto.thumbUrl ?? undefined) && (
                <img
                  src={withR2(selectedPhoto.thumbUrl) ?? undefined}
                  alt={selectedPhoto.title || ''}
                  className="w-full aspect-[4/3] object-cover"
                />
              )}
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 shadow text-lg"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold mb-1">{selectedPhoto.title || selectedPhoto.slug}</h3>
              {selectedPhoto.locationName && (
                <p className="text-sm text-gray-500 mb-1">📍 {selectedPhoto.locationName}</p>
              )}
              {selectedPhoto.galleryName && (
                <p className="text-sm text-gray-400 mb-3">Gallery: {selectedPhoto.galleryName}</p>
              )}
              <p className="text-xs font-mono text-gray-400 mb-4">
                {selectedPhoto.lat.toFixed(6)}, {selectedPhoto.lon.toFixed(6)}
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/photo/${selectedPhoto.slug}`}
                  className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  View Photo →
                </Link>
                {selectedPhoto.gallerySlug && (
                  <Link
                    href={`/gallery/${selectedPhoto.gallerySlug}`}
                    className="flex-1 text-center border border-gray-300 hover:border-gray-400 text-gray-600 text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    Gallery
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}