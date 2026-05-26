import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'typesense';
import { logSecurityEvent, hashIP, hashUA } from '@/lib/security/logger';

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
function getBotScore(ua: string): number {
  let score = 0;
  const uaLower = ua.toLowerCase();
  if (/headless|python|curl|wget|scrapy|axios/.test(uaLower)) score += 3;
  if (!ua.includes('Accept-Language')) score += 1;
  return score;
}

function extractCFXHeaders(request: NextRequest): Record<string, string | number | boolean | undefined> {
  const headers = request.headers;
  const cfBotScoreHeader = headers.get('cf-bot-score') || headers.get('cf-cur-bot-score');
  const botScore = cfBotScoreHeader ? parseInt(cfBotScoreHeader, 10) : undefined;
  const verifiedBotHeader = headers.get('cf-verified-bot');
  return {
    country: headers.get('cf-ipcountry') || undefined,
    colo: headers.get('cf-colo') || undefined,
    asn: headers.get('cf-asn') || undefined,
    cf_ray: headers.get('cf-ray') || undefined,
    bot_score: botScore,
    verified_bot: verifiedBotHeader === 'true' ? true : undefined,
    threat_score: headers.get('cf-threat-score') ? parseInt(headers.get('cf-threat-score')!, 10) : undefined,
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = parseInt(searchParams.get('page') || '1', 10);
  let perPage = parseInt(searchParams.get('per_page') || searchParams.get('limit') || '50', 10);
  
  // Cap response size — prevent abuse
  perPage = Math.min(perPage, 50);
  
  const ua = request.headers.get('user-agent') || '';
  const botScore = getBotScore(ua);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const ipHash = hashIP(ip);

  // Bot score 6+ — block and log
  if (botScore >= 6) {
    logSecurityEvent({
      request_path: '/api/search',
      request_method: 'GET',
      endpoint_group: 'search',
      ip_hash: ipHash,
      ...extractCFXHeaders(request),
      user_agent: ua,
      user_agent_hash: hashUA(ua),
      referer: request.headers.get('referer') || undefined,
      bot_score: botScore,
      action_taken: 'blocked',
      reason: 'bot_score_threshold_exceeded',
      status_code: 429,
      response_time_ms: Date.now() - startTime,
      metadata: { path: '/api/search', perPage, query },
    });
    return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }
  
  // Bot score 3-5 — downgrade and log
  if (botScore >= 3) {
    perPage = Math.min(perPage, 10);
    logSecurityEvent({
      request_path: '/api/search',
      request_method: 'GET',
      endpoint_group: 'search',
      ip_hash: ipHash,
      ...extractCFXHeaders(request),
      user_agent: ua,
      user_agent_hash: hashUA(ua),
      referer: request.headers.get('referer') || undefined,
      bot_score: botScore,
      action_taken: 'downgraded',
      reason: 'bot_score_medium',
      status_code: 200,
      response_time_ms: Date.now() - startTime,
      metadata: { perPage },
    });
  }
  
  const filters: string[] = [];
  const gallery = searchParams.get('gallery');
  const location = searchParams.get('location');
  const year = searchParams.get('year');
  if (gallery) filters.push(`gallery_slug:=${gallery}`);
  if (location) filters.push(`location_name:=${location}`);
  if (year) filters.push(`date_taken_year:=${year}`);
  const filterBy = filters.length > 0 ? filters.join(' && ') : undefined;

  try {
    const searchResult = await typesense
      .collections(COLLECTION)
      .documents()
      .search({
        q: query === '*' || !query ? '*' : query,
        query_by: 'title,keywords,location_name,species_common_name',
        filter_by: filterBy,
        sort_by: 'date_taken:desc',
        page,
        per_page: perPage,
        include_fields: 'id,slug,title,thumb_url,small_url,medium_url,large_url,keywords,gallery_slug,location_name,date_taken',
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
        keywords: hit.document.keywords,
        locationName: hit.document.location_name,
        gallery: hit.document.gallery_slug,
        takenYear: hit.document.date_taken ? Math.floor(hit.document.date_taken / 10000000000) : null,
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
    logSecurityEvent({
      request_path: '/api/search',
      request_method: 'GET',
      endpoint_group: 'search',
      ip_hash: ipHash,
      ...extractCFXHeaders(request),
      user_agent: ua,
      user_agent_hash: hashUA(ua),
      referer: request.headers.get('referer') || undefined,
      bot_score: botScore,
      action_taken: 'error',
      reason: 'search_exception',
      status_code: 500,
      response_time_ms: Date.now() - startTime,
      metadata: { error: error instanceof Error ? error.message : 'unknown' },
    });
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}