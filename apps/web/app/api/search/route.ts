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

// Bot score check helper
function getBotScore(ua: string, path: string): number {
  let score = 0;
  const uaLower = ua.toLowerCase();
  if (/headless|python|curl|wget|scrapy|axios/.test(uaLower)) score += 3;
  if (!ua.includes('Accept-Language')) score += 1;
  return score;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = parseInt(searchParams.get('page') || '1', 10);
  let perPage = parseInt(searchParams.get('per_page') || searchParams.get('limit') || '50', 10);
  
  // Cap response size — prevent abuse
  perPage = Math.min(perPage, 50);
  
  const ua = request.headers.get('user-agent') || '';
  const botScore = getBotScore(ua, '/api/search');
  
  // Bot score 6+ — block
  if (botScore >= 6) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }
  
  // Bot score 3-5 — serve fewer results
  if (botScore >= 3) {
    perPage = Math.min(perPage, 10);
  }
  
  const filters: string[] = [];
  const gallery = searchParams.get('gallery');
  const location = searchParams.get('location');
  const camera = searchParams.get('camera');
  const year = searchParams.get('year');
  const orientation = searchParams.get('orientation');
  if (gallery) filters.push(`gallery_slug:=${gallery}`);
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
        query_by: 'title,keywords,location,species_common_name',
        filter_by: filterBy,
        sort_by: 'date_uploaded:desc',
        page,
        per_page: perPage,
        facet_by: ['keywords', 'gallery_slug', 'location', 'orientation', 'camera_model', 'animal_group', 'region'],
        include_fields: 'id,slug,title,thumb_url,small_url,medium_url,large_url,preview_url,keywords,gallery_slug,location,taken_year',
      });

    const response = {
      photos: (searchResult.hits || []).map((hit: any) => ({
        id: hit.document.id,
        slug: hit.document.slug,
        title: hit.document.title,
        thumbUrl: hit.document.thumb_url,
        smallUrl: hit.document.small_url,
        mediumUrl: hit.document.medium_url,
        largeUrl: hit.document.large_url,
        previewUrl: hit.document.preview_url,
        keywords: hit.document.keywords,
        locationName: hit.document.location,
        gallery: hit.document.gallery_slug,
        takenYear: hit.document.taken_year,
      })),
      total: searchResult.found || 0,
      page: searchResult.page || page,
      per_page: perPage,
      hasMore: (searchResult.page || page) * perPage < (searchResult.found || 0),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
        'CDN-Cache-Control': 'public, max-age=600',
      }
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
