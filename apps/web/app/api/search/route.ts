import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'typesense';

const typesense = new Client({
  nodes: [{
    host: 'uibn03zvateqwdx2p-1.a1.typesense.net',
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_SEARCH_KEY || 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE',
});

const COLLECTION = 'photos';

// Typesense schema fields: slug, title, description, keywords[], category, country,
// region, location_name, gallery_slug, gallery_title, url, thumb_url, location,
// species, derivatives_complete, ready_for_public_render, search_ready,
// species_common_name, city_name
// Note: sort_by 'popularity' does NOT exist in the schema

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const perPage = Math.min(
    parseInt(searchParams.get('per_page') || searchParams.get('limit') || '20', 10),
    30  // cap at 30 for public search
  );

  // Filter parameters
  const gallery = searchParams.get('gallery');
  const location = searchParams.get('location');

  // Build filter_by
  const filters: string[] = [];
  if (gallery) filters.push(`gallery_slug:=${gallery}`);
  if (location) filters.push(`location_name:${location}`);

  const filterBy = filters.length > 0 ? filters.join(' && ') : undefined;

  try {
    const searchResult = await typesense
      .collections(COLLECTION)
      .documents()
      .search({
        q: query === '*' || !query ? '*' : query,
        query_by: "title,keywords,location_name,species_common_name",
        filter_by: filterBy,
        // Removed sort_by: 'popularity:desc' — field does not exist in schema
        // Default sort is by relevance for text queries
        page,
        per_page: perPage,
        // Only return fields actually used by SearchClient
        include_fields: "id,slug,title,thumb_url,location_name,species_common_name",
      });

    // Transform to API response — minimal fields for search cards
    const response = {
      photos: (searchResult.hits || []).map((hit: any) => ({
        id: hit.document.id,
        slug: hit.document.slug,
        title: hit.document.title,
        thumbUrl: hit.document.thumb_url,
        locationName: hit.document.location_name,
      })),
      total: searchResult.found || 0,
      page: searchResult.page || page,
      per_page: perPage,
      hasMore: (searchResult.page || page) * perPage < (searchResult.found || 0),
    };

    return NextResponse.json(response, {
      headers: {
        // Cache at CDN edge for 5 minutes — search results are personalized but stable
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}