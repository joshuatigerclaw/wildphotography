/**
 * Public API: GET /api/public/locations
 * 
 * Get all locations with rich metadata
 */
import { NextResponse } from 'next/server';
import { getAllLocations } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';

export const dynamic = 'force-dynamic';

export async function GET() {
  const locations = await getAllLocations();

  const response = {
    locations: locations.map(l => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      region: l.region,
      country: l.country,
      locationType: l.locationType,
      description: l.description,
      metadata: l.metadata,
      canonicalUrl: `${SITE_URL}/location/${l.slug}`,
    })),
  };

  // Validate: no null name or slug
  for (const location of response.locations) {
    if (!location.name || !location.slug) {
      return NextResponse.json({ error: 'Invalid location data: null fields detected' }, { status: 500 });
    }
  }

  return NextResponse.json(response);
}
