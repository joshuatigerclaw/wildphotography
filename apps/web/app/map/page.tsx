import { Metadata } from 'next';
import { sql } from '@/lib/db';
import PhotoMapClient from './PhotoMapClient';

const SITE_URL = 'https://wildphotography.com';
const R2_PUBLIC = 'https://images.wildphotography.com';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Interactive Costa Rica Photo Map | Wildphotography',
  description: 'Explore thousands of geotagged Costa Rica photos by location, from beaches and waterfalls to wildlife habitats and national parks.',
  alternates: {
    canonical: '/map',
  },
  openGraph: {
    title: 'Interactive Costa Rica Photo Map',
    description: 'Explore thousands of geotagged Costa Rica photos by location, from beaches and waterfalls to wildlife habitats and national parks.',
    url: `${SITE_URL}/map`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

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

async function getGeotaggedPhotos(): Promise<MapPhoto[]> {
  try {
    const result = await sql`
      SELECT DISTINCT ON (p.id)
        p.id, p.slug, p.title,
        p.thumb_url, p.lat, p.lon,
        p.location_name,
        g.name as gallery_name, g.slug as gallery_slug
      FROM photos p
      LEFT JOIN gallery_photos gp ON gp.photo_id = p.id
      LEFT JOIN galleries g ON g.id = gp.gallery_id
      WHERE p.is_active = true
        AND p.ready_for_public_render = true
        AND p.lat IS NOT NULL
        AND p.lon IS NOT NULL
        AND p.lat != 0
        AND p.lon != 0
      ORDER BY p.id
      LIMIT 500
    `;

    return (result as any[]).map((row: any) => ({
      id: String(row.id),
      slug: row.slug || '',
      title: row.title || null,
      thumbUrl: row.thumb_url || null,
      lat: parseFloat(row.lat) || 0,
      lon: parseFloat(row.lon) || 0,
      locationName: row.location_name || null,
      galleryName: row.gallery_name || null,
      gallerySlug: row.gallery_slug || null,
    }));
  } catch (e) {
    console.error('Error fetching geotagged photos:', e);
    return [];
  }
}

export default async function PhotoMapPage() {
  const photos = await getGeotaggedPhotos();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Interactive Costa Rica Photo Map',
    description: 'Explore thousands of geotagged Costa Rica photos by location, from beaches and waterfalls to wildlife habitats and national parks.',
    url: `${SITE_URL}/map`,
    author: {
      '@type': 'Person',
      name: 'Joshua ten Brink',
    },
    about: {
      '@type': 'Map',
      name: 'Costa Rica Photo Locations',
      description: 'Geotagged photography locations across Costa Rica',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--gutter) var(--gutter) calc(var(--gutter) * 3)' }}>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--gutter)', fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-dim)' }}>
          <ol style={{ display: 'flex', alignItems: 'center', gap: '10px', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
            <li><a href="/" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>Home</a></li>
            <li>/</li>
            <li style={{ color: 'var(--ink-muted)' }}>Photo Map</li>
          </ol>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 'calc(var(--gutter) * 1.5)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1, margin: '0 0 16px 0', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}>
            Interactive Costa Rica Photo Map
          </h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '16px', lineHeight: 1.6, maxWidth: '580px', margin: 0 }}>
            Explore thousands of geotagged Costa Rica photos by location, from beaches and waterfalls to wildlife habitats and national parks.
          </p>
        </header>

        {/* Map client */}
        <PhotoMapClient photos={photos} />
      </div>
    </>
  );
}