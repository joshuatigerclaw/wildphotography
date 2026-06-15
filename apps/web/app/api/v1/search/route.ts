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

// Plan-based include_fields gating (uses only fields that exist in production schema)
function getIncludeFields(planId: string): string {
  // Production schema fields: title, description, keywords, location, region, country,
  //   species, gallery_slug, gallery_title, slug, url,
  //   search_ready, derivatives_complete, ready_for_public_render,
  //   location_name, thumb_url, species_common_name
  switch (planId) {
    case 'explorer':
      return 'slug,title,location_name,thumb_url,gallery_slug';
    case 'professional':
      return 'slug,title,location_name,thumb_url,gallery_slug,species_common_name,keywords';
    case 'enterprise':
    default:
      return 'slug,title,description,keywords,location_name,thumb_url,gallery_slug,gallery_title,species_common_name,search_ready';
  }
}

function mapHitToResponse(hit: any, planId: string) {
  const doc = hit.document;
  const base = {
    slug: doc.slug,
    title: doc.title,
  };
  switch (planId) {
    case 'explorer':
      return {
        ...base,
        thumbUrl: doc.thumb_url,
        locationName: doc.location_name,
        gallery: doc.gallery_slug,
      };
    case 'professional':
      return {
        ...base,
        thumbUrl: doc.thumb_url,
        locationName: doc.location_name,
        gallery: doc.gallery_slug,
        species: doc.species_common_name,
        keywords: doc.keywords,
      };
    case 'enterprise':
    default:
      return {
        ...base,
        title: doc.title,
        description: doc.description,
        keywords: doc.keywords,
        locationName: doc.location_name,
        gallery: doc.gallery_slug,
        galleryTitle: doc.gallery_title,
        species: doc.species_common_name,
        searchReady: doc.search_ready,
      };
  }
}

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

  // Plan-based per_page cap
  if (perPage > 20) perPage = 20;

  const typesense = new Client({
    nodes: [{ host: TYPESENSE_HOST, port: 443, protocol: 'https' }],
    apiKey: TYPESENSE_SEARCH_KEY,
    additionalHeaders: { 'Accept-Encoding': 'gzip' },
  });

  const includeFields = getIncludeFields(customer.planId);

  try {
    const result = await typesense
      .collections(COLLECTION)
      .documents()
      .search({
        q: query === '*' || !query ? '*' : query,
        query_by: 'title,keywords,location_name,species',
        sort_by: 'search_ready:desc',
        page,
        per_page: perPage,
        include_fields: includeFields,
      });

    const total = result.found || 0;

    return NextResponse.json({
      photos: (result.hits || []).map((hit: any) => mapHitToResponse(hit, customer.planId)),
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
