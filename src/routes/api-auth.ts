/**
 * API Authentication & Quota Middleware
 * WildPhotography API Platform — Phase 3
 */

import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

const NEON_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// ─── Rate Limiting State ────────────────────────────────────────────────────

const keyRateLimit = new Map<number, { count: number; windowStart: number }>();
const ipRateLimit = new Map<string, { count: number; windowStart: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000;
const IP_RATE_LIMIT_MAX = 200;

const PLAN_RATE_LIMITS: Record<string, number> = {
  explorer: 60,
  professional: 120,
  enterprise: 240
};

// ─── Rate Limit Helper ──────────────────────────────────────────────────────

interface RateLimitResult {
  allowed: boolean;
  error?: string;
  error_code?: 'rate_limit_exceeded' | 'monthly_quota_exceeded';
  retryAfter?: number;
}

function checkRateLimit(apiKeyId: number, ip: string, planSlug: string): RateLimitResult {
  const now = Date.now();
  const maxRequests = PLAN_RATE_LIMITS[planSlug] ?? 60;

  // ── Layer 1: Per-key abuse protection ──
  const keyEntry = keyRateLimit.get(apiKeyId);
  if (!keyEntry || now - keyEntry.windowStart > RATE_LIMIT_WINDOW_MS) {
    keyRateLimit.set(apiKeyId, { count: 1, windowStart: now });
  } else {
    keyEntry.count++;
    if (keyEntry.count > maxRequests) {
      return {
        allowed: false,
        error: 'Rate limit exceeded for API key',
        error_code: 'rate_limit_exceeded',
        retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - keyEntry.windowStart)) / 1000) || 60
      };
    }
  }

  // ── Layer 2: IP emergency throttle ──
  const ipEntry = ipRateLimit.get(ip);
  if (!ipEntry || now - ipEntry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRateLimit.set(ip, { count: 1, windowStart: now });
  } else {
    ipEntry.count++;
    if (ipEntry.count > IP_RATE_LIMIT_MAX) {
      return {
        allowed: false,
        error: 'Rate limit exceeded for IP address',
        error_code: 'rate_limit_exceeded',
        retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - ipEntry.windowStart)) / 1000) || 60
      };
    }
  }

  return { allowed: true };
}

// ─── Auth Result Interface ──────────────────────────────────────────────────

export interface ApiCustomer {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  plan_id: number;
  status: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
}

export interface ApiPlan {
  id: number;
  slug: string;
  name: string;
  regular_price_monthly: number;
  launch_price_monthly: number;
  monthly_call_limit: number;
  allowed_derivative_sizes: string[];
  attribution_required: boolean;
  commercial_use_allowed: boolean;
  ai_agent_use_allowed: boolean;
  max_results_default: number;
  max_results_limit: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  error_code?: 'invalid_api_key' | 'inactive_subscription' | 'monthly_quota_exceeded' | 'rate_limit_exceeded' | 'api_error';
  retryAfter?: number;
  customer?: ApiCustomer;
  plan?: ApiPlan;
  api_key_id?: number;
}

/**
 * Hash a full API key to compare stored hash
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key
 */
export function generateApiKey(): { prefix: string; secret: string; full: string } {
  const prefix = 'wild_live_' + randomString(8);
  const secret = randomString(32);
  const full = `${prefix}_${secret}`;
  return { prefix, secret, full };
}

/**
 * Get current period key (YYYYMM)
 */
export function getCurrentPeriod(): number {
  const now = new Date();
  return parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
}

/**
 * Extract client IP from request headers
 */
export function extractClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return 'unknown';
}

/**
 * Authenticate an API key and return customer/plan info
 */
export async function authenticateKey(bearerKey: string, clientIp?: string): Promise<AuthResult> {
  if (!bearerKey || !bearerKey.startsWith('wild_live_')) {
    return { success: false, error: 'Invalid API key format', error_code: 'invalid_api_key' };
  }

  const parts = bearerKey.split('_');
  if (parts.length < 4) {
    return { success: false, error: 'Invalid API key format', error_code: 'invalid_api_key' };
  }

  // Extract prefix: first 3 parts joined (wild + live + random_prefix)
  // The key format is wild_live_XXXXYYYY_SECRET where XXXXYYYY is the random prefix
  // and the secret may contain underscores, so we can't just slice(0,4)
  const prefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
  // The secret is everything after the 3rd underscore
  const secret = bearerKey.substring(prefix.length + 1);
  const keyHash = hashApiKey(bearerKey);

  const sql = neon(NEON_CONNECTION);

  try {
    // Find key by prefix + hash
    const keyRows = await sql`
      SELECT ak.id, ak.customer_id, ak.status, ak.created_at,
             ac.id as cust_id, ac.email, ac.name, ac.company, ac.plan_id,
             ac.status as cust_status, ac.current_period_start, ac.current_period_end,
             ap.slug as plan_slug, ap.name as plan_name, ap.regular_price_monthly,
             ap.launch_price_monthly, ap.monthly_call_limit, ap.allowed_derivative_sizes,
             ap.attribution_required, ap.commercial_use_allowed, ap.ai_agent_use_allowed,
             ap.max_results_default, ap.max_results_limit
      FROM api_keys ak
      JOIN api_customers ac ON ak.customer_id = ac.id
      JOIN api_plans ap ON ac.plan_id = ap.id
      WHERE ak.key_prefix = ${prefix}
        AND ak.key_hash = ${keyHash}
      LIMIT 1
    `;

    if (keyRows.length === 0) {
      return { success: false, error: 'Invalid API key', error_code: 'invalid_api_key' };
    }

    const row = keyRows[0];

    // Check if key is revoked
    if (row.status === 'revoked') {
      return { success: false, error: 'API key has been revoked', error_code: 'invalid_api_key' };
    }

    // Check if customer is active
    if (row.cust_status !== 'active' && row.cust_status !== 'trialing') {
      return { success: false, error: 'Account subscription is not active', error_code: 'inactive_subscription' };
    }

    // Check monthly quota
    const period = getCurrentPeriod();
    const usageRows = await sql`
      SELECT calls_used FROM api_monthly_usage
      WHERE customer_id = ${row.cust_id} AND period_yyyymm = ${period}
      LIMIT 1
    `;

    const callsUsed = usageRows.length > 0 ? usageRows[0].calls_used : 0;

    if (callsUsed >= row.monthly_call_limit) {
      return {
        success: false,
        error: `Monthly quota of ${row.monthly_call_limit} calls exceeded`,
        error_code: 'monthly_quota_exceeded'
      };
    }

    // ── Rate limit check AFTER quota check, BEFORE returning success ──
    if (clientIp && clientIp !== 'unknown') {
      const rateLimitResult = checkRateLimit(row.id, clientIp, row.plan_slug);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: rateLimitResult.error,
          error_code: rateLimitResult.error_code,
          retryAfter: rateLimitResult.retryAfter
        };
      }
    }

    // Parse allowed derivative sizes
    let allowedSizes: string[] = [];
    try {
      allowedSizes = typeof row.allowed_derivative_sizes === 'string'
        ? JSON.parse(row.allowed_derivative_sizes)
        : row.allowed_derivative_sizes;
    } catch (e) {
      allowedSizes = ['thumb', 'small'];
    }

    // Update last_used_at
    await sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${row.id}`;

    return {
      success: true,
      customer: {
        id: row.cust_id,
        email: row.email,
        name: row.name,
        company: row.company,
        plan_id: row.plan_id,
        status: row.cust_status,
        current_period_start: row.current_period_start,
        current_period_end: row.current_period_end
      },
      plan: {
        id: row.plan_id,
        slug: row.plan_slug,
        name: row.plan_name,
        regular_price_monthly: row.regular_price_monthly,
        launch_price_monthly: row.launch_price_monthly,
        monthly_call_limit: row.monthly_call_limit,
        allowed_derivative_sizes: allowedSizes,
        attribution_required: row.attribution_required,
        commercial_use_allowed: row.commercial_use_allowed,
        ai_agent_use_allowed: row.ai_agent_use_allowed,
        max_results_default: row.max_results_default,
        max_results_limit: row.max_results_limit
      },
      api_key_id: row.id
    };

  } catch (err: any) {
    console.error('[auth] DB error:', err.message);
    return { success: false, error: 'Authentication error', error_code: 'api_error' };
  }
}

/**
 * Increment monthly usage counter
 */
export async function incrementUsage(customerId: number, apiKeyId: number): Promise<void> {
  const sql = neon(NEON_CONNECTION);
  const period = getCurrentPeriod();

  try {
    await sql`
      INSERT INTO api_monthly_usage (customer_id, api_key_id, period_yyyymm, calls_used, updated_at)
      VALUES (${customerId}, ${apiKeyId}, ${period}, 1, NOW())
      ON CONFLICT (customer_id, api_key_id, period_yyyymm)
      DO UPDATE SET calls_used = api_monthly_usage.calls_used + 1, updated_at = NOW()
    `;
  } catch (err: any) {
    console.error('[auth] Failed to increment usage:', err.message);
  }
}

/**
 * Log an API usage event
 */
export async function logUsageEvent(
  customerId: number,
  apiKeyId: number,
  endpoint: string,
  requestPath: string,
  responseStatus: number,
  unitsUsed: number = 1,
  ipHash?: string,
  userAgentHash?: string
): Promise<void> {
  const sql = neon(NEON_CONNECTION);

  try {
    await sql`
      INSERT INTO api_usage_events
        (customer_id, api_key_id, endpoint, request_path, response_status, units_used, ip_hash, user_agent_hash)
      VALUES
        (${customerId}, ${apiKeyId}, ${endpoint}, ${requestPath}, ${responseStatus}, ${unitsUsed}, ${ipHash || null}, ${userAgentHash || null})
    `;
  } catch (err: any) {
    console.error('[auth] Failed to log usage event:', err.message);
  }
}

/**
 * Get usage summary for a customer
 */
export async function getUsageSummary(customerId: number): Promise<{
  plan_name: string;
  monthly_limit: number;
  calls_used: number;
  calls_remaining: number;
  period_end: string;
}> {
  const sql = neon(NEON_CONNECTION);
  const period = getCurrentPeriod();

  const rows = await sql`
    SELECT ap.name as plan_name, ap.monthly_call_limit, ap.regular_price_monthly, ap.launch_price_monthly,
           COALESCE(amu.calls_used, 0) as calls_used,
           ac.current_period_end
    FROM api_customers ac
    JOIN api_plans ap ON ac.plan_id = ap.id
    LEFT JOIN api_monthly_usage amu ON ac.id = amu.customer_id AND amu.period_yyyymm = ${period}
    WHERE ac.id = ${customerId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error('Customer not found');
  }

  const row = rows[0];
  const callsUsed = Number(row.calls_used);
  const limit = Number(row.monthly_call_limit);

  return {
    plan_name: row.plan_name,
    monthly_limit: limit,
    calls_used: callsUsed,
    calls_remaining: Math.max(0, limit - callsUsed),
    period_end: row.current_period_end
      ? new Date(row.current_period_end).toISOString()
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
  };
}

/**
 * Create a new API key for a customer
 */
export async function createApiKey(
  customerId: number,
  name: string = 'Default Key'
): Promise<{ id: number; prefix: string; secret: string; full: string; key_hash: string }> {
  const sql = neon(NEON_CONNECTION);
  const keyInfo = generateApiKey();
  const keyHash = hashApiKey(keyInfo.full);

  const rows = await sql`
    INSERT INTO api_keys (customer_id, key_prefix, key_hash, name, status)
    VALUES (${customerId}, ${keyInfo.prefix}, ${keyHash}, ${name}, 'active')
    RETURNING id, key_prefix
  `;

  return {
    id: rows[0].id,
    prefix: keyInfo.prefix,
    secret: keyInfo.secret,
    full: keyInfo.full,
    key_hash: keyHash
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: number): Promise<void> {
  const sql = neon(NEON_CONNECTION);
  await sql`
    UPDATE api_keys
    SET status = 'revoked', revoked_at = NOW()
    WHERE id = ${keyId}
  `;
}

/**
 * Build auth middleware response for error cases
 */
export function authErrorResponse(result: AuthResult): Response {
  const statusMap: Record<string, number> = {
    invalid_api_key: 401,
    inactive_subscription: 403,
    monthly_quota_exceeded: 429,
    rate_limit_exceeded: 429,
    api_error: 500
  };

  const status = statusMap[result.error_code || 'api_error'] || 401;

  const body: Record<string, unknown> = {
    error: result.error_code || 'api_error',
    message: result.error || 'An error occurred'
  };

  if (result.retryAfter !== undefined) {
    body.retry_after = result.retryAfter;
  }

  return Response.json(body, { status });
}

// ─── Helper Utilities ────────────────────────────────────────────────────────

function randomString(length: number): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}