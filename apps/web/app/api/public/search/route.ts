/**
 * Public API: GET /api/public/search?q=
 * Cacheable public search endpoint
 *
 * Uses Neon HTTP SQL API (direct fetch, no WebSocket needed).
 * Pooler IP + Host header + neon-connection-string header.
 * Replaces Typesense (died Aug 2025).
 */
import { NextRequest, NextResponse } from 'next/server';
import { logSecurityEvent, hashIP, hashUA } from '@/lib/security/logger';

const POOLER_HOST = 'ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech';
const CONN_STR = `postgresql://neondb_owner:npg_GonqSbJlRi71@${POOLER_HOST}/wildphotography?sslmode=require`;

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

async function neonSql<T = any>(query: string): Promise<T> {
  const resp = await fetch(`https://${POOLER_HOST}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': POOLER_HOST,
      'neon-connection-string': CONN_STR,
    },
    body: JSON.stringify({ query, params: [] }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Neon HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (data.errors?.length) {
    throw new Error(data.errors[0].message);
  }
  return data;
}

async function searchPhotos(q: string, page: number, perPage: number) {
  const offset = (page - 1) * perPage;

  if (!q || q === '*') {
    const [countData, photosData] = await Promise.all([
      neonSql<{ rows: { count: string }[] }>(
        `SELECT COUNT(*) FROM photos p WHERE p.search_ready = true AND p.is_active = true`
      ),
      neonSql<{ rows: any[] }>(
        `SELECT p.slug, p.title, p.location_name, p.thumb_url, p.gallery_slug
         FROM photos p
         WHERE p.search_ready = true AND p.is_active = true
         ORDER BY p.id DESC
         LIMIT ${perPage} OFFSET ${offset}`
      ),
    ]);
    return { total: parseInt(countData.rows[0].count, 10), photos: photosData.rows };
  }

  // Escape special ILIKE characters to prevent SQL injection
  const term = q.replace(/[%_\\]/g, '\\$&');
  // Weighted relevance scoring using pg_trgm similarity
  // Title (4x), species (3x), location (2x), keywords (1x)
  const scoreExpr = `
    GREATEST(
      similarity('${term}', p.title) * 4,
      similarity('${term}', COALESCE(p.species_common_name, '')) * 3,
      similarity('${term}', COALESCE(p.location_name, '')) * 2,
      similarity('${term}', COALESCE(p.keywords, '')) * 1
    )`;

  const [countData, photosData] = await Promise.all([
    neonSql<{ rows: { count: string }[] }>(
      `SELECT COUNT(*) FROM photos p
       WHERE p.search_ready = true AND p.is_active = true
         AND (p.title ILIKE '%${term}%' OR p.keywords::text ILIKE '%${term}%'
              OR p.location_name ILIKE '%${term}%' OR p.species_common_name ILIKE '%${term}%')`
    ),
    neonSql<{ rows: any[] }>(
      `SELECT p.slug, p.title, p.location_name, p.thumb_url, p.gallery_slug,
              ${scoreExpr} AS score
       FROM photos p
       WHERE p.search_ready = true AND p.is_active = true
         AND (p.title ILIKE '%${term}%' OR p.keywords::text ILIKE '%${term}%'
              OR p.location_name ILIKE '%${term}%' OR p.species_common_name ILIKE '%${term}%')
       ORDER BY score DESC, p.id DESC
       LIMIT ${perPage} OFFSET ${offset}`
    ),
  ]);
  return { total: parseInt(countData.rows[0].count, 10), photos: photosData.rows };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  let perPage = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const ipHash = hashIP(ip);

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

  try {
    const { photos, total } = await searchPhotos(query, page, perPage);

    const result = photos.map((row) => ({
      title: row.title,
      slug: row.slug,
      location: row.location_name,
      images: { thumb: row.thumb_url },
      canonicalUrl: `https://wildphotography.com/photo/${row.slug}`,
      score: row.score ? parseFloat(row.score) : null,
    }));

    return NextResponse.json({
      photos: result,
      total,
      page,
      per_page: perPage,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
        'CDN-Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
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
      reason: 'neon_search_exception',
      status_code: 500,
      response_time_ms: Date.now() - startTime,
      metadata: { error: errMsg },
    });
    console.error('[search] Error:', errMsg);
    return NextResponse.json({ error: 'Search failed', detail: errMsg }, { status: 500 });
  }
}
