/**
 * Public API: GET /api/public/region
 * 
 * Get all regions with rich metadata
 */
import { NextResponse } from 'next/server';
import { getAllRegions } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';

export const dynamic = 'force-dynamic';

export async function GET() {
  const regions = await getAllRegions();

  const response = {
    regions: regions.map(r => ({
      name: r.name,
      slug: r.slug,
      photoCount: r.photoCount,
      sampleThumb: r.sampleThumb,
      overview: r.overview || null,
      highlights: r.highlights || [],
      galleryLinks: r.galleryLinks || [],
      speciesLinks: r.speciesLinks || [],
      bestSeason: r.bestSeason || null,
      photographyTips: r.photographyTips || null,
      canonicalUrl: `${SITE_URL}/region/${r.slug}`,
    })),
  };

  // Validate: no null name or slug
  for (const region of response.regions) {
    if (!region.name || !region.slug) {
      return NextResponse.json({ error: 'Invalid region data: null fields detected' }, { status: 500 });
    }
    // Validate gallery links have required fields
    for (const g of region.galleryLinks) {
      if (!g.name || !g.slug) {
        return NextResponse.json({ error: 'Invalid gallery link: null fields detected' }, { status: 500 });
      }
    }
    // Validate species links have required fields
    for (const s of region.speciesLinks) {
      if (!s.name || !s.slug) {
        return NextResponse.json({ error: 'Invalid species link: null fields detected' }, { status: 500 });
      }
    }
  }

  return NextResponse.json(response);
}
