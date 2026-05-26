/**
 * API v1: Search endpoint — requires valid API key
 * GET /api/v1/search?q=...
 * Auth: Bearer token (wpa_...)
 */
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'typesense';
import { validateApiKey } from '@/lib/api-auth';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_SEARCH_KEY = process.env.TYPESENSE_SEARCH_KEY || 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE';
const COLLECTION = 'photos';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Authenticate
  const auth = await validateApiKey(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { customer } = auth;

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  let perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || searchParams.get('limit') || '20', 10)));

  // Plan-based per_page cap (conservative)
  if (perPage > 20) perPage = 20;

  const typesense = new Client({
    nodes: [{ host: TYPESENSE_HOST, port: 443, protocol: 'https' }],
    apiKey: TYPESENSE_SEARCH_KEY,
  });

  try {
    const result = await typesense
      .collections(COLLECTION)
      .documents()
      .search({
        q: query === '*' || !query ? '*' : query,
        query_by: 'title,keywords,location_name,species_common_name',
        sort_by: 'date_taken:desc',
        page,
        per_page: perPage,
        include_fields: 'id,slug,title,thumb_url,small_url,medium_url,large_url,keywords,gallery_slug,location_name,date_taken',
      });

    const total = result.found || 0;

    return NextResponse.json({
      photos: (result.hits || []).map((hit: any) => ({
        id: String(hit.document.id),
        slug: hit.document.slug,
        title: hit.document.title,
        thumbUrl: hit.document.thumb_url,
        smallUrl: hit.document.small_url,
        mediumUrl: hit.document.medium_url,
        largeUrl: hit.document.large_url,
        keywords: hit.document.keywords,
        locationName: hit.document.location_name,
        gallery: hit.document.gallery_slug,
      })),
      total,
      page,
      per_page: perPage,
      hasMore: page * perPage < total,
      quota: {
        plan: customer.planName,
        limit: customer.monthlyLimit,
        resetsAt: `${customer.yearMonth}-01`,
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'CDN-Cache-Control': 'no-store',
        'X-API-Plan': customer.planId,
      },
    });
  } catch (e) {
    console.error('v1/search error:', e);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}