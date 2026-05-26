/**
 * Public API: GET /api/public/search?q=
 * Cacheable public search endpoint
 */
import { Client } from 'typesense';
import { NextRequest, NextResponse } from 'next/server';
import { logSecurityEvent, hashIP, hashUA } from '@/lib/security/logger';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_SEARCH_KEY = process.env.TYPESENSE_SEARCH_KEY || 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE';
export const dynamic = 'force-dynamic';

function extractCFXHeaders(request: NextRequest): Record<string, string | number | boolean | undefined> {
  const headers = request.headers;
  return {
    country: headers.get('cf-ipcountry') || undefined,
    colo: headers.get('cf-colo') || undefined,
    asn: headers.get('cf-asn') || undefined,
    cf_ray: headers.get('cf-ray') || undefined,
    threat_score: headers.get('cf-threat-score') ? parseInt(headers.get('cf-threat-score')!, 10) : undefined,
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = parseInt(searchParams.get('page') || '1', 10);
  let perPage = parseInt(searchParams.get('limit') || '20', 10);
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const ipHash = hashIP(ip);

  perPage = Math.min(perPage, 50);
  
  const isBotUA = /headless|python|curl|wget|scrapy|axios|phantom|selenium|playwright|puppeteer/i.test(ua);
  if (isBotUA) {
    perPage = Math.min(perPage, 10);
    logSecurityEvent({
      request_path: '/api/public/search',
      request_method: 'GET',
      endpoint_group: 'public_search',
      ip_hash: ipHash,
      ...extractCFXHeaders(request),
      user_agent: ua,
      user_agent_hash: hashUA(ua),
      referer: request.headers.get('referer') || undefined,
      action_taken: 'downgraded',
      reason: 'bot_ua_detected',
      status_code: 200,
      response_time_ms: Date.now() - startTime,
      metadata: { perPage },
    });
  }

  const typesense = new Client({
    nodes: [{ host: TYPESENSE_HOST, port: 443, protocol: 'https' }],
    apiKey: TYPESENSE_SEARCH_KEY,
  });

  try {
    const results = await typesense
      .collections('photos')
      .documents()
      .search({
        q: query,
        query_by: 'title,keywords,location_name,species_common_name',
        page,
        per_page: perPage,
        include_fields: 'id,slug,title,description,keywords,location_name,thumb_url,medium_url,gallery_slug',
      });

    const photos = (results.hits || []).map((hit: any) => ({
      title: hit.document.title,
      slug: hit.document.slug,
      description: hit.document.description,
      keywords: hit.document.keywords,
      location: hit.document.location_name,
      images: { thumb: hit.document.thumb_url, medium: hit.document.medium_url },
      canonicalUrl: `https://wildphotography.com/photo/${hit.document.slug}`,
    }));

    return NextResponse.json({
      photos,
      total: results.found || 0,
      page: results.page || page,
      per_page: perPage,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
        'CDN-Cache-Control': 'public, max-age=600',
      }
    });
  } catch (error) {
    logSecurityEvent({
      request_path: '/api/public/search',
      request_method: 'GET',
      endpoint_group: 'public_search',
      ip_hash: ipHash,
      ...extractCFXHeaders(request),
      user_agent: ua,
      user_agent_hash: hashUA(ua),
      referer: request.headers.get('referer') || undefined,
      action_taken: 'error',
      reason: 'typesense_search_exception',
      status_code: 500,
      response_time_ms: Date.now() - startTime,
      metadata: { error: error instanceof Error ? error.message : 'unknown' },
    });
    console.error('[search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}