/**
 * GET /api/v1/search
 * Authenticated photo search via raw fetch to Typesense (bypasses SDK initialization).
 * 
 * Headers: X-API-Key: <key>
 * Query: q, page, per_page (max 100), gallery, location
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
);

const TYPESENSE_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_KEY = 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE';

export const dynamic = 'force-dynamic';

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authenticate(req: NextRequest) {
  const rawKey = req.headers.get('X-API-Key');
  if (!rawKey) return { error: 'unauthorized', status: 401, message: 'Missing X-API-Key header' };
  if (rawKey.length < 32) return { error: 'unauthorized', status: 401, message: 'Invalid API key format' };

  const keyHash = await sha256(rawKey);

  let keys;
  try {
    keys = await sql`
      SELECT k.id, k.key_hash, k.key_prefix,
             c.id as cust_id, c.plan_id,
             p.slug as plan_slug, p.monthly_call_limit,
             p.allowed_derivative_sizes, p.attribution_required,
             p.commercial_use_allowed, p.max_results_default, p.max_results_limit,
             p.active as plan_active
      FROM api_keys k
      JOIN api_customers c ON k.customer_id = c.id
      JOIN api_plans p ON c.plan_id = p.id
      WHERE k.key_hash = ${keyHash}
        AND k.status = 'active'
        AND k.revoked_at IS NULL
        AND p.active = true
      LIMIT 1
    `;
  } catch (e: any) {
    return { error: 'auth_db_error', status: 500, message: e?.message || 'Auth DB error' };
  }

  if (!keys.length) return { error: 'unauthorized', status: 401, message: 'Invalid or revoked API key' };

  const key = keys[0];

  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

  let usage = 0;
  try {
    const periodYyyymm = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
    const usageRows = await sql`
      SELECT COALESCE(SUM(calls_used), 0) as used
      FROM api_monthly_usage
      WHERE api_key_id = ${key.id}
        AND period_yyyymm <= ${periodYyyymm}
    `;
    usage = Number(usageRows[0]?.used || 0);
  } catch (e) { /* ignore */ }

  const monthlyLimit = Number(key.monthly_call_limit) || 0;
  const remainingCalls = Math.max(0, monthlyLimit - usage);

  return {
    error: null,
    status: 200,
    keyId: key.id,
    planSlug: key.plan_slug,
    allowedDerivatives: key.allowed_derivative_sizes || [],
    monthlyLimit,
    usedThisMonth: usage,
    remainingCalls,
    attributionRequired: key.attribution_required || false,
    commercialUseAllowed: key.commercial_use_allowed || false,
    maxResultsDefault: key.max_results_default || 20,
    maxResultsLimit: key.max_results_limit || 100,
  };
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error, message: auth.message }, { status: auth.status });
  }

  if (auth.remainingCalls <= 0) {
    return NextResponse.json(
      { error: 'quota_exceeded', plan: auth.planSlug, limit: auth.monthlyLimit },
      { status: 429 }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const query = encodeURIComponent(searchParams.get('q') || '*');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const requestedPerPage = parseInt(searchParams.get('per_page') || String(auth.maxResultsDefault), 10);
  const perPage = Math.min(requestedPerPage, Math.min(auth.maxResultsLimit, 100));

  const filters: string[] = [];
  const gallery = searchParams.get('gallery');
  if (gallery) filters.push(`gallery:${gallery}`);
  const location = searchParams.get('location');
  if (location) filters.push(`location_name:${location}`);
  const filterBy = filters.length > 0 ? `&filter_by=${filters.join('&&')}` : '';

  const typesenseUrl = 
    `https://${TYPESENSE_HOST}/collections/photos/documents/search` +
    `?q=${query}` +
    `&query_by=title,keywords,location_name,species` +
    `&sort_by=_text_match:desc` +
    `&page=${page}` +
    `&per_page=${perPage}` +
    `&include_fields=id,slug,title,thumb_url,small_url,medium_url,large_url,preview_url,location_name,species,keywords` +
    filterBy;

  let typesenseData: any = null;
  let typesenseError: string | null = null;

  try {
    const tsResp = await fetch(typesenseUrl, {
      headers: {
        'X-Typesense-Api-Key': TYPESENSE_KEY,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });
    if (!tsResp.ok) {
      const errText = await tsResp.text();
      typesenseError = `Typesense ${tsResp.status}: ${errText.slice(0, 200)}`;
    } else {
      typesenseData = await tsResp.json() as any;
    }
  } catch (e: any) {
    typesenseError = e?.message || 'Typesense fetch failed';
  }

  // Log usage
  try {
    const now = new Date();
    const periodYyyymm = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;

    await sql`
      INSERT INTO api_monthly_usage (customer_id, api_key_id, period_yyyymm, calls_used)
      VALUES (${key.cust_id}, ${auth.keyId}, ${periodYyyymm}, 1)
      ON CONFLICT (customer_id, api_key_id, period_yyyymm)
      DO UPDATE SET
        calls_used = api_monthly_usage.calls_used + 1
    `;

    await sql`
      INSERT INTO api_usage_events (customer_id, api_key_id, endpoint, response_status, units_used)
      VALUES (${key.cust_id}, ${auth.keyId}, '/api/v1/search', ${typesenseError ? 500 : 200}, ${typesenseData?.hits?.length || 0})
    `;

    await sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${auth.keyId}`;
  } catch (e) { /* don't break response */ }

  if (typesenseError) {
    return NextResponse.json(
      { error: 'search_failed', message: typesenseError },
      { status: 500 }
    );
  }

  // Map derivatives by explicit field name (not string manipulation)
  const derivativeFields: Array<[string, string, string]> = [
    ['thumb', 'thumb_url', 'thumbUrl'],
    ['small', 'small_url', 'smallUrl'],
    ['medium', 'medium_url', 'mediumUrl'],
    ['large', 'large_url', 'largeUrl'],
    ['preview', 'preview_url', 'previewUrl'],
  ];

  const photos = (typesenseData?.hits || []).map((hit: any) => {
    const photo: Record<string, any> = {
      id: hit.document.id,
      slug: hit.document.slug,
      title: hit.document.title,
      locationName: hit.document.location_name,
      speciesName: hit.document.species || '',
      keywords: hit.document.keywords,
    };

    for (const [size, tsField, apiField] of derivativeFields) {
      if (auth.allowedDerivatives.includes(size) && hit.document[tsField]) {
        photo[apiField] = hit.document[tsField];
      }
    }

    return photo;
  });

  return NextResponse.json(
    {
      photos,
      total: typesenseData?.found || 0,
      page,
      per_page: perPage,
      hasMore: page * perPage < (typesenseData?.found || 0),
      _meta: {
        plan: auth.planSlug,
        allowed_derivatives: auth.allowedDerivatives,
        attribution_required: auth.attributionRequired,
      }
    },
    {
      headers: {
        'X-RateLimit-Limit': String(auth.monthlyLimit),
        'X-RateLimit-Remaining': String(auth.remainingCalls - 1),
        'X-Plan': auth.planSlug,
      }
    }
  );
}