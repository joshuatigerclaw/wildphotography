/**
 * Public API: GET /api/public/search?q=
 *
 * Minimal search for downstream consumers — strips heavy fields to reduce
 * Typesense response payload and bandwidth costs.
 *
 * Schema fields: slug, title, description, keywords[], category, country, region,
 * location_name, gallery_slug, gallery_title, url, thumb_url, location, species,
 * species_common_name, city_name
 */

import { Client } from 'typesense';
import { NextRequest, NextResponse } from 'next/server';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_SEARCH_KEY = process.env.TYPESENSE_SEARCH_KEY || 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const perPage = Math.min(
    parseInt(searchParams.get('limit') || '20', 10),
    30  // cap at 30 to prevent large payloads
  );

  if (!query.trim()) {
    return NextResponse.json({ photos: [], total: 0, page: 1, per_page: perPage });
  }

  const typesense = new Client({
    nodes: [{ host: TYPESENSE_HOST, port: 443, protocol: 'https' }],
    apiKey: TYPESENSE_SEARCH_KEY,
  });

  try {
    // Schema has: title, keywords, location_name, species_common_name
    // Schema has 'location' (string) and 'location_name' — query both
    const results = await typesense
      .collections('photos')
      .documents()
      .search({
        q: query,
        query_by: "title,keywords,location_name,species_common_name",
        page,
        per_page: perPage,
        // Only request fields needed for public search cards
        include_fields: "id,slug,title,thumb_url,location_name,species_common_name,gallery_slug",
        // No sort — relevance is default
      });

    // Minimal response — no description, no keywords, no derivative URLs
    const photos = (results.hits || []).map((hit: any) => ({
      id: hit.document.id,
      slug: hit.document.slug,
      title: hit.document.title,
      thumbUrl: hit.document.thumb_url,
      locationName: hit.document.location_name,
      speciesName: hit.document.species_common_name,
      gallerySlug: hit.document.gallery_slug,
      canonicalUrl: `https://wildphotography.com/photo/${hit.document.slug}`,
    }));

    return NextResponse.json({
      photos,
      total: results.found || 0,
      page: results.page || page,
      per_page: perPage,
    }, {
      headers: {
        // Cache at CDN edge for 5 minutes
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}