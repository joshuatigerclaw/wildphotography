/**
 * API Key auth + usage tracking — D1 only (Neon removed).
 *
 * Auth path: D1 via Cloudflare REST API (~50-150ms from CF edge)
 *
 * Behavior:
 *   missing key → 401 | invalid key → 401 | inactive sub → 403
 *   quota exceeded → 429 | valid key → 200
 *   usage increments every authenticated request (D1 inline, non-blocking fire-and-forget)
 *   never returns raw API key
 *
 * Observability:
 *   console.log: d1_auth_success | d1_auth_error
 */

import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

// ── Types ───────────────────────────────────────────────────────────────────

export type AuthenticatedCustomer = {
  customerId: number;
  email: string;
  planId: string;
  planName: string;
  monthlyLimit: number;
  yearMonth: string;
};

// ── D1 via Cloudflare REST API ───────────────────────────────────────────────
// Uses CLOUDFLARE_API_TOKEN secret via process.env.
// D1 REST API from CF edge: ~50-150ms.

const D1_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const D1_DB_ID = '57a98059-434d-46a3-a72b-8aa8a87b0fdc';

interface D1Result {
  results: Array<{ [col: string]: string | number | null }>;
  success: boolean;
}

function getCfToken(): string | undefined {
  return (process.env as Record<string, string | undefined>).CLOUDFLARE_API_TOKEN;
}

async function d1Query<T = Record<string, string | number | null>>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T | null> {
  const token = getCfToken();
  if (!token) {
    console.error('[d1] CLOUDFLARE_API_TOKEN not in process.env');
    return null;
  }
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DB_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[d1] API error:', res.status, text.slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { result: D1Result[]; success: boolean };
    const result = data.result?.[0];
    if (!result?.success) {
      console.error('[d1] Query failed, success=false');
      return null;
    }
    if (!result.results?.length) {
      return null;
    }
    return result.results[0] as T;
  } catch (e) {
    console.error('[d1] Query error:', (e as Error).message);
    return null;
  }
}

async function d1Exec(
  sql: string,
  params: (string | number | null)[] = []
): Promise<boolean> {
  const token = getCfToken();
  if (!token) return false;
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DB_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) {
      console.error('[d1] Exec error:', res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[d1] Exec error:', (e as Error).message);
    return false;
  }
}

// ── Key hashing ─────────────────────────────────────────────────────────────

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function hashField(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// ── Year-month helpers ───────────────────────────────────────────────────────

function currentYearMonthInt(): number {
  const now = new Date();
  return now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
}

function currentYearMonthStr(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Usage event logging (D1) ─────────────────────────────────────────────────

interface UsageEvent {
  customerId: number;
  keyId: number;
  endpoint: string;
  requestPath: string;
  responseStatus: number;
  unitsUsed?: number;
  userAgent?: string;
  ipAddress?: string;
}

async function logUsageEvent(event: UsageEvent): Promise<void> {
  const uaHash = event.userAgent ? hashField(event.userAgent).slice(0, 16) : null;
  const ipHash = event.ipAddress ? hashField(event.ipAddress).slice(0, 16) : null;
  await d1Exec(
    `INSERT INTO api_usage_events
       (customer_id, api_key_id, endpoint, request_path, response_status, units_used, user_agent_hash, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.customerId,
      event.keyId,
      event.endpoint,
      event.requestPath,
      event.responseStatus,
      event.unitsUsed ?? 1,
      uaHash,
      ipHash,
    ]
  );
}

// ── Auth: D1 only (Neon removed) ────────────────────────────────────────────

export async function validateApiKey(
  req: NextRequest
): Promise<
  | { authorized: true; customer: AuthenticatedCustomer }
  | { authorized: false; status: number; message: string }
> {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { authorized: false, status: 401, message: 'Missing or invalid Authorization header. Expected: Bearer wpa_...' };
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith('wpa_') || rawKey.length < 40) {
    return { authorized: false, status: 401, message: 'Invalid API key format.' };
  }

  const keyHash = hashApiKey(rawKey);
  const yearMonthInt = currentYearMonthInt();
  const yearMonthStr = currentYearMonthStr();

  // ── D1 auth ──────────────────────────────────────────────────────────────
  const d1Row = await d1Query<{
    key_id: number;
    customer_id: number;
    key_status: string;
    customer_status: string;
    email: string;
    plan_id: string;
    plan_name: string;
    monthly_call_limit: number;
    calls_used: number;
  }>(
    `SELECT
       k.id AS key_id,
       k.customer_id,
       k.status AS key_status,
       c.status AS customer_status,
       c.email,
       c.plan_id,
       c.plan_name,
       c.monthly_call_limit,
       COALESCE(u.calls_used, 0) AS calls_used
     FROM api_keys k
     JOIN api_customers c ON c.id = k.customer_id
     LEFT JOIN api_monthly_usage u
       ON u.customer_id = k.customer_id
      AND u.period_yyyymm = ?
     WHERE k.key_hash = ?`,
    [yearMonthInt, keyHash]
  );

  if (d1Row) {
    console.log('[d1] Auth success key_id=' + d1Row.key_id);

    if (d1Row.key_status !== 'active') {
      const endpoint = req.nextUrl.pathname.split('/').pop() || 'unknown';
      logUsageEvent({
        customerId: d1Row.customer_id,
        keyId: d1Row.key_id,
        endpoint,
        requestPath: req.nextUrl.pathname,
        responseStatus: 401,
        userAgent: req.headers.get('user-agent') || undefined,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || undefined,
      }).catch(() => {});
      return { authorized: false, status: 401, message: 'API key has been revoked.' };
    }
    if (d1Row.customer_status !== 'active') {
      const endpoint = req.nextUrl.pathname.split('/').pop() || 'unknown';
      logUsageEvent({
        customerId: d1Row.customer_id,
        keyId: d1Row.key_id,
        endpoint,
        requestPath: req.nextUrl.pathname,
        responseStatus: 403,
        userAgent: req.headers.get('user-agent') || undefined,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || undefined,
      }).catch(() => {});
      return { authorized: false, status: 403, message: 'Account is not active. Please contact support.' };
    }
    if (d1Row.calls_used >= d1Row.monthly_call_limit) {
      const endpoint = req.nextUrl.pathname.split('/').pop() || 'unknown';
      logUsageEvent({
        customerId: d1Row.customer_id,
        keyId: d1Row.key_id,
        endpoint,
        requestPath: req.nextUrl.pathname,
        responseStatus: 429,
        userAgent: req.headers.get('user-agent') || undefined,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || undefined,
      }).catch(() => {});
      return {
        authorized: false,
        status: 429,
        message: `Monthly limit reached (${d1Row.monthly_call_limit} calls/month). Resets on the 1st of next month.`,
      };
    }

    // Increment usage in D1 (inline — after() not reliable in CF Workers for outbound fetch)
    d1IncrementUsage(d1Row.key_id, d1Row.customer_id, yearMonthInt).catch(
      (e: Error) => console.error('[d1] Usage increment error:', e.message)
    );
    // Log successful call (sample ~10%)
    if (Math.random() < 0.1) {
      const endpoint = req.nextUrl.pathname.split('/').pop() || 'unknown';
      logUsageEvent({
        customerId: d1Row.customer_id,
        keyId: d1Row.key_id,
        endpoint,
        requestPath: req.nextUrl.pathname,
        responseStatus: 200,
        userAgent: req.headers.get('user-agent') || undefined,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || undefined,
      }).catch(() => {});
    }

    return {
      authorized: true,
      customer: {
        customerId: d1Row.customer_id,
        email: d1Row.email,
        planId: d1Row.plan_id,
        planName: d1Row.plan_name,
        monthlyLimit: d1Row.monthly_call_limit,
        yearMonth: yearMonthStr,
      },
    };
  }

  // D1 is authoritative — key not found in D1
  return { authorized: false, status: 401, message: 'Invalid API key.' };
}

// ── Usage increment ─────────────────────────────────────────────────────────────

async function d1IncrementUsage(
  keyId: number,
  customerId: number,
  yearMonthInt: number
): Promise<void> {
  await d1Exec(
    `INSERT INTO api_monthly_usage (customer_id, api_key_id, period_yyyymm, calls_used)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (customer_id, period_yyyymm)
     DO UPDATE SET calls_used = api_monthly_usage.calls_used + 1`,
    [customerId, keyId, yearMonthInt]
  );
}
