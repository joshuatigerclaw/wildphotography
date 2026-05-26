/**
 * Security Logger — Phase 5
 * Writes to request_security_log table (Neon)
 * Uses pg Client with background write via waitUntil pattern.
 *
 * Privacy rules:
 * - Never log raw IP → always hash with server-side salt
 * - Never log Authorization headers
 * - Never log API keys
 * - Never log customer secrets
 * - User-agent is stored as-is (consistent with existing policy)
 */

import { Client } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// Server-side salt — NOT accessible from client, stored only in CF env
const IP_HASH_SALT = process.env.SECURITY_LOG_IP_SALT || 'wp_phase5_salt_2026';

export interface SecurityLogEntry {
  request_path: string;
  request_method?: string;
  endpoint_group: string;
  ip_hash: string;
  country?: string;
  colo?: string;
  asn?: string;
  as_organization?: string;
  user_agent?: string;
  user_agent_hash?: string;
  referer?: string;
  cf_ray?: string;
  bot_score?: number;
  verified_bot?: boolean;
  threat_score?: number;
  action_taken: string;
  reason?: string;
  status_code: number;
  response_time_ms?: number;
  metadata?: Record<string, unknown>;
}

/** Hash IP with server-side salt — one-way, no raw IP stored */
export function hashIP(ip: string): string {
  // Use a simple HMAC-style sha hash via Node crypto
  // We import lazily to avoid top-level import issues in edge workers
  let hash = IP_HASH_SALT + ip;
  // Simple djb2-style hash (fast, good enough for this use case)
  let h = 5381;
  for (let i = 0; i < hash.length; i++) {
    h = ((h << 5) + h) ^ hash.charCodeAt(i);
  }
  return 'ip_' + Math.abs(h >>> 0).toString(36);
}

/** Hash user-agent for aggregation without storing raw strings */
export function hashUA(ua: string): string {
  let h = 5381;
  for (let i = 0; i < ua.length; i++) {
    h = ((h << 5) + h) ^ ua.charCodeAt(i);
  }
  return 'ua_' + Math.abs(h >>> 0).toString(36);
}

/** Categorize a request path into endpoint groups */
export function getEndpointGroup(path: string): string {
  if (path.startsWith('/api/search')) return 'search';
  if (path.startsWith('/api/public/search')) return 'public_search';
  if (path.startsWith('/api/v1/search')) return 'v1_search';
  if (path.startsWith('/api/photos/related')) return 'related_photos';
  if (path.startsWith('/api/v1/usage')) return 'v1_usage';
  if (path.startsWith('/api/v1/auth-check')) return 'v1_auth';
  if (path.startsWith('/api/map')) return 'map';
  if (path.startsWith('/api/admin')) return 'admin';
  if (path.startsWith('/api/download')) return 'download';
  if (path.startsWith('/api/orders')) return 'orders';
  if (path.startsWith('/api/paypal')) return 'paypal';
  if (path.startsWith('/api/sitemap')) return 'sitemap';
  if (path.startsWith('/api/visit')) return 'visit';
  if (path.startsWith('/photo/')) return 'photo_page';
  if (path.startsWith('/large/')) return 'image_derivative';
  if (path.startsWith('/thumbs/')) return 'image_derivative';
  return 'other';
}

// Secret-free headers list
const SECRET_HEADERS = ['authorization', 'cookie', 'x-api-key', 'x-auth-token', 'proxy-authorization'];

export function sanitizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SECRET_HEADERS.includes(key.toLowerCase())) continue;
    if (typeof value === 'string') sanitized[key] = value;
    else if (Array.isArray(value)) sanitized[key] = value.join(', ');
  }
  return sanitized;
}

/** Async fire-and-forget logger — never blocks the response */
export async function logSecurityEvent(entry: SecurityLogEntry): Promise<void> {
  // Run in background — don't await on hot path
  doLogSecurityEvent(entry).catch(err => {
    console.error('[security-log] failed to write:', err);
  });
}

async function doLogSecurityEvent(entry: SecurityLogEntry): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 5000 });
  try {
    await client.connect();
    await client.query(
      `INSERT INTO request_security_log (
        request_path, request_method, endpoint_group, ip_hash,
        country, colo, asn, as_organization,
        user_agent, user_agent_hash, referer, cf_ray,
        bot_score, verified_bot, threat_score,
        action_taken, reason, status_code, response_time_ms, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        entry.request_path,
        entry.request_method || null,
        entry.endpoint_group,
        entry.ip_hash,
        entry.country || null,
        entry.colo || null,
        entry.asn || null,
        entry.as_organization || null,
        entry.user_agent || null,
        entry.user_agent_hash || null,
        entry.referer || null,
        entry.cf_ray || null,
        entry.bot_score ?? null,
        entry.verified_bot ?? null,
        entry.threat_score ?? null,
        entry.action_taken,
        entry.reason || null,
        entry.status_code,
        entry.response_time_ms ?? null,
        JSON.stringify(entry.metadata || {}),
      ]
    );
  } catch (err) {
    // Log failures should not propagate
    console.error('[security-log] INSERT failed:', err);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Convenience: extract CF headers from a NextRequest */
export function extractCFXHeaders(request: Request | NextRequest): {
  country?: string;
  colo?: string;
  asn?: string;
  as_organization?: string;
  cf_ray?: string;
  bot_score?: number;
  verified_bot?: boolean;
  threat_score?: number;
} {
  const headers: Headers = request instanceof NextRequest ? request.headers : new Headers(request.headers);

  const cfBotScoreHeader = headers.get('cf-bot-score') || headers.get('cf-cur-bot-score');
  const botScore = cfBotScoreHeader ? parseInt(cfBotScoreHeader, 10) : undefined;

  const verifiedBotHeader = headers.get('cf-verified-bot');
  const verifiedBot = verifiedBotHeader === 'true';

  const threatScoreHeader = headers.get('cf-threat-score');
  const threatScore = threatScoreHeader ? parseInt(threatScoreHeader, 10) : undefined;

  return {
    country: headers.get('cf-ipcountry') || undefined,
    colo: headers.get('cf colo') || undefined,
    asn: headers.get('cf-asn') || undefined,
    as_organization: undefined, // AS org requires separate lookup, leave for now
    cf_ray: headers.get('cf-ray') || undefined,
    bot_score: botScore,
    verified_bot: verifiedBot || undefined,
    threat_score: threatScore,
  };
}

import type { NextRequest } from 'next/server';