/**
 * GET /api/v1/auth-check
 * No auth. Tests the authentication flow directly and returns debug info.
 * Used to diagnose why valid keys are being rejected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
);

export const dynamic = 'force-dynamic';

// Simple SHA-256 hash
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(req: NextRequest) {
  const rawKey = req.headers.get('X-API-Key') || 'wild_live_cc79a1e4b5b3b8dcf9bbd0bbe39b39f7';
  
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  // Test 1: Direct key lookup by hash
  let byHash: any[] = [];
  try {
    byHash = await sql`
      SELECT k.id, k.key_hash, k.key_prefix, k.status, k.revoked_at,
             c.id as cust_id, c.plan_id,
             p.slug as plan_slug, p.active as plan_active
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
    byHash = [{ error: e.message, code: e.code }];
  }

  // Test 2: Lookup by prefix
  let byPrefix: any[] = [];
  try {
    byPrefix = await sql`
      SELECT k.id, k.key_hash, k.key_prefix, k.status,
             p.slug as plan_slug
      FROM api_keys k
      JOIN api_customers c ON k.customer_id = c.id
      JOIN api_plans p ON c.plan_id = p.id
      WHERE k.key_prefix = ${keyPrefix}
        AND k.status = 'active'
        AND k.revoked_at IS NULL
      LIMIT 1
    `;
  } catch (e: any) {
    byPrefix = [{ error: e.message }];
  }

  // Test 3: Count all active keys
  let keyCount = -1;
  try {
    const countResult = await sql`SELECT COUNT(*) as cnt FROM api_keys WHERE status = 'active' AND revoked_at IS NULL`;
    keyCount = Number(countResult[0]?.cnt || 0);
  } catch (e: any) {
    keyCount = -1;
  }

  return NextResponse.json({
    provided_key: rawKey,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    lookup_by_hash: byHash,
    lookup_by_prefix: byPrefix,
    total_active_keys: keyCount,
    raw_header_received: req.headers.get('X-API-Key') || null,
  });
}