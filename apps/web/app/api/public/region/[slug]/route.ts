/**
 * Public API: GET /api/public/region/:slug
 * 
 * Get a single region by slug with rich metadata
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRegionBySlug } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const region = await getRegionBySlug(slug);
  if (!region) {
    return NextResponse.json({ error: 'Region not found' }, { status: 404 });
  }

  const response = {
    ...region,
    canonicalUrl: `${SITE_URL}/region/${region.slug}`,
  };

  // Validate: no null name or slug
  if (!response.name || !response.slug) {
    return NextResponse.json({ error: 'Invalid region data: null fields detected' }, { status: 500 });
  }
  // Validate gallery links have required fields
  for (const g of response.galleryLinks || []) {
    if (!g.name || !g.slug) {
      return NextResponse.json({ error: 'Invalid gallery link: null fields detected' }, { status: 500 });
    }
  }
  // Validate species links have required fields
  for (const s of response.speciesLinks || []) {
    if (!s.name || !s.slug) {
      return NextResponse.json({ error: 'Invalid species link: null fields detected' }, { status: 500 });
    }
  }

  return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=7200',
      }
    });
}
