/**
 * Public API: GET /api/public/search?q=
 * 
 * Search photos for downstream consumers
 */

import { Client } from 'typesense';
import { NextRequest, NextResponse } from 'next/server';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_SEARCH_KEY = process.env.TYPESENSE_SEARCH_KEY || 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('limit') || '20', 10);
  
  const typesense = new Client({
    nodes: [{
      host: TYPESENSE_HOST,
      port: 443,
      protocol: 'https',
    }],
    apiKey: TYPESENSE_SEARCH_KEY,
  });

  try {
    const results = await typesense
      .collections('photos')
      .documents()
      .search({
        q: query,
        query_by: 'title,description,keywords,location',
        page,
        per_page: perPage,
      });

    // Transform to response (NO original URLs)
    const photos = (results.hits || []).map((hit: any) => ({
      title: hit.document.title,
      slug: hit.document.slug,
      description: hit.document.description,
      keywords: hit.document.keywords,
      location: hit.document.location,
      images: {
        thumb: hit.document.thumb_url,
        medium: hit.document.medium_url,
      },
      canonicalUrl: `https://wildphotography.com/photo/${hit.document.slug}`,
    }));

    return NextResponse.json({
      photos,
      total: results.found || 0,
      page: results.page || page,
      per_page: perPage,
    });
  } catch (error) {
    console.error('[search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
