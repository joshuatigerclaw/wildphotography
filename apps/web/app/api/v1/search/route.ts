/**
 * API v1: Search endpoint — requires valid API key
 * GET /api/v1/search?q=...
 * Auth: Bearer token (wpa_...)
 *
 * Uses Neon PostgreSQL with GIN trigram indexes for full-text search.
 * Replaces Typesense (which died Aug 2025).
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { validateApiKey } from '@/lib/api-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = neon(
  process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_GonqSbJlRi71@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
) as ReturnType<typeof neon> & { unsafe: (sql: string) => any };

export const dynamic = 'force-dynamic';

async function doSearch(q: string, page: number, perPage: number, planId: string) {
  const offset = (page - 1) * perPage;
  const baseFields = `p.id, p.slug, p.title, p.thumb_url, p.medium_url, p.small_url,
    p.gallery_slug, p.location_name, p.keywords, p.species_common_name,
    p.description, g.name as gallery_title, p.search_ready`;

  if (!q || q === '*') {
    const [countRows, photoRows] = await Promise.all([
      sql`SELECT COUNT(*) FROM photos p WHERE p.search_ready = true AND p.is_active = true`,
      sql`SELECT ${sql.unsafe(baseFields)}
          FROM photos p
          LEFT JOIN galleries g ON g.slug = p.gallery_slug AND g.is_active = true
          WHERE p.search_ready = true AND p.is_active = true
          ORDER BY p.id DESC
          LIMIT ${perPage} OFFSET ${offset}`,
    ]);
    return { total: parseInt((countRows as any)[0].count, 10), photos: photoRows as any[] };
  }

  const term = q.replace(/[%_\\]/g, '\\$&');
  const [countRows, photoRows] = await Promise.all([
    sql`SELECT COUNT(*) FROM photos p
        WHERE p.search_ready = true AND p.is_active = true
          AND (p.title ILIKE '%' || ${term} || '%'
               OR p.keywords::text ILIKE '%' || ${term} || '%'
               OR p.location_name ILIKE '%' || ${term} || '%'
               OR p.species_common_name ILIKE '%' || ${term} || '%')`,
    sql`SELECT ${sql.unsafe(baseFields)}
        FROM photos p
        LEFT JOIN galleries g ON g.slug = p.gallery_slug AND g.is_active = true
        WHERE p.search_ready = true AND p.is_active = true
          AND (p.title ILIKE '%' || ${term} || '%'
               OR p.keywords::text ILIKE '%' || ${term} || '%'
               OR p.location_name ILIKE '%' || ${term} || '%'
               OR p.species_common_name ILIKE '%' || ${term} || '%')
        ORDER BY p.id DESC
        LIMIT ${perPage} OFFSET ${offset}`,
  ]);
  return { total: parseInt((countRows as any)[0].count, 10), photos: photoRows as any[] };
}

function mapFields(row: any, planId: string) {
  const base: Record<string, unknown> = { slug: row.slug, title: row.title };
  if (planId === 'explorer') {
    return { ...base, thumbUrl: row.thumb_url, locationName: row.location_name, gallery: row.gallery_slug };
  }
  if (planId === 'professional') {
    return { ...base, thumbUrl: row.thumb_url, locationName: row.location_name, gallery: row.gallery_slug, species: row.species_common_name, keywords: row.keywords };
  }
  return {
    ...base,
    title: row.title,
    description: row.description,
    keywords: row.keywords,
    locationName: row.location_name,
    gallery: row.gallery_slug,
    galleryTitle: row.gallery_title,
    species: row.species_common_name,
    searchReady: row.search_ready,
  };
}

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { customer } = auth;

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  let perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || searchParams.get('limit') || '20', 10)));
  if (perPage > 20) perPage = 20;

  try {
    const { total, photos } = await doSearch(query, page, perPage, customer.planId);

    return NextResponse.json({
      photos: photos.map((row) => mapFields(row, customer.planId)),
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 }
    );
  }
}
