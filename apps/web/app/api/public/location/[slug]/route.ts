/**
 * Public API: GET /api/public/location/:slug
 * 
 * Get location with rich metadata for downstream consumers
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLocationBySlug, getLocationsByRegion, getPhotosByLocation } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const location = await getLocationBySlug(slug);
  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }

  const regionLocations = await getLocationsByRegion(location.region || '');
  const { photos } = await getPhotosByLocation(slug, 20, 0);

  const response = {
    id: location.id,
    name: location.name,
    slug: location.slug,
    region: location.region,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
    locationType: location.locationType,
    description: location.description,
    metadata: location.metadata,
    canonicalUrl: `${SITE_URL}/location/${slug}`,
    regionLocations: regionLocations
      .filter(l => l.slug !== slug)
      .map(l => ({ name: l.name, slug: l.slug, description: l.description })),
    samplePhotos: photos.slice(0, 6).map((p: any) => ({
      slug: p.slug,
      title: p.title,
      thumbUrl: p.thumbUrl,
      canonicalUrl: `${SITE_URL}/photo/${p.slug}`,
    })),
  };

  // Validate: no null fields in key data
  if (!response.name || !response.slug || !response.region) {
    return NextResponse.json({ error: 'Invalid location data: null fields detected' }, { status: 500 });
  }

  return NextResponse.json(response);
}
