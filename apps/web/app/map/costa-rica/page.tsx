/**
 * Costa Rica Photo Map — WildPhotography
 * Route: /map/costa-rica
 * Shows all geotagged photos on an interactive map.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

interface MapPhoto {
  id: number;
  slug: string;
  title: string;
  thumb_url: string;
  location_name: string;
  city_name: string | null;
  province_name: string | null;
  gallery_slug: string | null;
}

interface GeoFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: MapPhoto & { coordinates: [number, number] };
}

export default function CostaRicaMapPage() {
  const [photos, setPhotos] = useState<MapPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMap() {
      try {
        // Load Leaflet CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Load Leaflet JS
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Leaflet'));
          document.head.appendChild(script);
        });

        if (!mounted) return;

        // Load photo markers
        const res = await fetch('/api/map/photos?limit=1000');
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();
        if (!mounted) return;

        const geoFeatures: GeoFeature[] = data.features || [];
        setPhotos(geoFeatures.map((f: GeoFeature) => f.properties));

        // @ts-ignore
        const L = window.L;
        if (!L) {
          setError('Map library failed to load');
          setLoading(false);
          return;
        }

        // Initialize map centered on Costa Rica
        const map = L.map('map').setView([9.9, -84.1], 8);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(map);

        // Add photo markers
        for (const feature of geoFeatures) {
          const { geometry, properties } = feature;
          const [lng, lat] = geometry.coordinates;

          const thumb = properties.thumb_url;
          const imgHtml = `<img src="${thumb}" width="80" height="60" style="object-fit:cover;border-radius:4px;" loading="lazy" />`;

          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              html: `<div style="width:80px;height:60px;overflow:hidden;border-radius:4px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${imgHtml}</div>`,
              className: '',
              iconSize: [80, 60],
              iconAnchor: [40, 60],
            }),
          }).addTo(map);

          marker.bindPopup(`
            <div style="min-width:120px;">
              <img src="${properties.thumb_url}" style="width:120px;height:90px;object-fit:cover;border-radius:4px;margin-bottom:6px;" loading="lazy" />
              <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${properties.title || properties.location_name || 'Photo'}</div>
              ${properties.location_name ? `<div style="font-size:11px;color:#666;">${properties.location_name}</div>` : ''}
              <a href="/photo/${properties.slug}" style="display:inline-block;margin-top:6px;font-size:12px;color:#2563eb;font-weight:500;">View photo →</a>
            </div>
          `, {
            maxWidth: 160,
            minWidth: 130,
          });
        }

        setLoading(false);
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load map');
          setLoading(false);
        }
      }
    }

    loadMap();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #e5e7eb', background: 'white', padding: '0 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>Costa Rica Photo Map</h1>
            <p style={{ fontSize: 13, color: '#666', margin: '2px 0 0' }}>
              {loading ? 'Loading...' : `${photos.length.toLocaleString()} geotagged photos`}
            </p>
          </div>
          <a href="/" style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none' }}>← Wildphotography</a>
        </div>
      </header>

      {/* Map container */}
      <div style={{ position: 'relative', height: 'calc(100vh - 65px)' }}>
        {loading && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '10px 20px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, fontSize: 14 }}>
            Loading map...
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#fee2e2', padding: '10px 20px', borderRadius: 8, zIndex: 1000, fontSize: 14, color: '#b91c1c' }}>
            Error: {error}
          </div>
        )}
        <div id="map" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}