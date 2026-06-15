/**
 * WildPhotography API v1 — Shared Authentication & Plan Resolution
 * 
 * Validates X-API-Key header against api_keys table.
 * Resolves customer's plan and enforces quota limits.
 * Logs every API call to api_usage_events.
 * 
 * Plan derivative size access:
 * - explorer:     thumb, small
 * - professional: thumb, small, medium
 * - enterprise:   thumb, small, medium, large, preview
 */

import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

const sql = neon(
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
);

export const dynamic = 'force-dynamic';

// ── Auth ─────────────────────────────────────────────────────────────────────

interface AuthResult {
  customerId: number;
  planId: number;
  planSlug: string;
  allowedDerivatives: string[];
  monthlyLimit: number;
  usedThisMonth: number;
  remainingCalls: number;
  attributionRequired: boolean;
  commercialUseAllowed: boolean;
}

export async function authenticate(req: NextRequest): Promise<AuthResult | NextResponse> {
  const rawKey = req.headers.get('X-API-Key');

  if (!rawKey) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Missing X-API-Key header' },
      { status: 401 }
    );
  }

  if (rawKey.length < 32) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid API key format' },
      { status: 401 }
    );
  }

  // Hash the key with SHA-256 to compare against stored hash
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Look up the key
  const keys = await sql(`
    SELECT k.id, k.customer_id, k.status, k.revoked_at,
           c.id as cust_id, c.plan_id,
           p.slug as plan_slug, p.monthly_call_limit,
           p.allowed_derivative_sizes, p.attribution_required,
           p.commercial_use_allowed, p.active as plan_active
    FROM api_keys k
    JOIN api_customers c ON k.customer_id = c.id
    JOIN api_plans p ON c.plan_id = p.id
    WHERE k.key_hash = ${keyHash}
      AND k.status = 'active'
      AND k.revoked_at IS NULL
      AND p.active = true
  `);

  if (!keys.length) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid or revoked API key' },
      { status: 401 }
    );
  }

  const key = keys[0];

  // Get this month's usage
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

  const usageRows = await sql(`
    SELECT COALESCE(SUM(call_count), 0) as used
    FROM api_monthly_usage
    WHERE api_key_id = ${key.id}
      AND period_month >= ${monthStart}
  `);

  const usedThisMonth = Number(usageRows[0].used) || 0;
  const monthlyLimit = Number(key.monthly_call_limit) || 0;
  const remainingCalls = Math.max(0, monthlyLimit - usedThisMonth);

  return {
    customerId: key.customer_id,
    planId: key.plan_id,
    planSlug: key.plan_slug,
    allowedDerivatives: key.allowed_derivative_sizes || [],
    monthlyLimit,
    usedThisMonth,
    remainingCalls,
    attributionRequired: key.attribution_required || false,
    commercialUseAllowed: key.commercial_use_allowed || false,
  };
}

// ── Quota enforcement ────────────────────────────────────────────────────────

export function checkQuota(auth: AuthResult): NextResponse | null {
  if (auth.remainingCalls <= 0) {
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message: `Monthly limit of ${auth.monthlyLimit} calls reached for ${auth.planSlug} plan`,
        plan: auth.planSlug,
        limit: auth.monthlyLimit,
        reset_date: getNextMonthStart(),
      },
      { status: 429 }
    );
  }
  return null;
}

// ── Usage logging ─────────────────────────────────────────────────────────────

export async function logUsage(
  apiKeyId: number,
  endpoint: string,
  callCount: number = 1,
  resultCount: number = 0,
  errorMessage: string | null = null
): Promise<void> {
  try {
    const now = new Date();
    const periodMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

    // Upsert monthly usage
    await sql(`
      INSERT INTO api_monthly_usage (api_key_id, period_month, call_count, successful_calls, error_calls)
      VALUES (${apiKeyId}, ${periodMonth}, ${callCount},
              ${errorMessage ? 0 : callCount},
              ${errorMessage ? callCount : 0})
      ON CONFLICT (api_key_id, period_month)
      DO UPDATE SET
        call_count = api_monthly_usage.call_count + ${callCount},
        successful_calls = api_monthly_usage.successful_calls + ${errorMessage ? 0 : callCount},
        error_calls = api_monthly_usage.error_calls + ${errorMessage ? callCount : 0}
    `);

    // Log individual event
    await sql(`
      INSERT INTO api_usage_events (api_key_id, endpoint, call_count, result_count, error_message)
      VALUES (${apiKeyId}, ${endpoint}, ${callCount}, ${resultCount}, ${errorMessage})
    `);

    // Update last_used_at on the key
    await sql(`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${apiKeyId}`);
  } catch (e) {
    // Don't let logging failures break the API response
    console.error('[api-usage] logging failed:', e);
  }
}

// ── Derivative filtering ──────────────────────────────────────────────────────

export function filterDerivatives(
  photo: Record<string, any>,
  allowedDerivatives: string[]
): Record<string, any> {
  const derivativeMap: Record<string, string> = {
    thumb: 'thumbUrl',
    small: 'smallUrl',
    medium: 'mediumUrl',
    large: 'largeUrl',
    preview: 'previewUrl',
  };

  const filtered = { ...photo };

  // Remove originals from all API responses (never expose)
  delete filtered.originalUrl;
  delete filtered.original_r2_key;

  // Keep only the allowed derivative sizes
  for (const [size, field] of Object.entries(derivativeMap)) {
    if (!allowedDerivatives.includes(size)) {
      delete filtered[field];
    }
  }

  // Add metadata fields about what's included/excluded
  filtered._meta = {
    included_derivatives: allowedDerivatives,
    attribution_required: photo._meta?.attributionRequired || false,
  };

  return filtered;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getNextMonthStart(): string {
  const now = new Date();
  const nextMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
}

export function formatUsageHeaders(auth: AuthResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(auth.monthlyLimit),
    'X-RateLimit-Remaining': String(auth.remainingCalls),
    'X-RateLimit-Reset': getNextMonthStart(),
    'X-Plan': auth.planSlug,
  };
}