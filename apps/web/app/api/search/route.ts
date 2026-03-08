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

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || searchParams.get('limit') || '50', 10);
  
  // Filter parameters
  const gallery = searchParams.get('gallery');
  const location = searchParams.get('location');
  const camera = searchParams.get('camera');
  const year = searchParams.get('year');
  const orientation = searchParams.get('orientation');
  
  // Build filter_by
  const filters: string[] = [];
  if (gallery) filters.push(`gallery:=${gallery}`);
  if (location) filters.push(`location:=${location}`);
  if (camera) filters.push(`camera_model:=${camera}`);
  if (year) filters.push(`taken_year:=${year}`);
  if (orientation) filters.push(`orientation:=${orientation}`);
  
  const filterBy = filters.length > 0 ? filters.join(' && ') : undefined;

  try {
    const searchResult = await typesense
      .collections(COLLECTION)
      .documents()
      .search({
        q: query === '*' || !query ? '*' : query,
        query_by: 'title,description,keywords,location,gallery',
        filter_by: filterBy,
        sort_by: 'date_uploaded:desc',
        page,
        per_page: perPage,
        facet_by: ['keywords', 'gallery', 'location', 'orientation', 'camera_model', 'lens', 'taken_year'],
        include_fields: 'id,slug,title,thumb_url,small_url,medium_url,large_url,keywords,gallery,location,taken_year',
      });

    // Transform to API response format
    const response = {
      photos: (searchResult.hits || []).map((hit: any) => ({
        id: hit.document.id,
        slug: hit.document.slug,
        title: hit.document.title,
        thumbUrl: hit.document.thumb_url,
        smallUrl: hit.document.small_url,
        mediumUrl: hit.document.medium_url,
        largeUrl: hit.document.large_url,
        keywords: hit.document.keywords,
        locationName: hit.document.location,
        gallery: hit.document.gallery,
        takenYear: hit.document.taken_year,
      })),
      total: searchResult.found || 0,
      page: searchResult.page || page,
      per_page: perPage,
      hasMore: (searchResult.page || page) * perPage < (searchResult.found || 0),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
