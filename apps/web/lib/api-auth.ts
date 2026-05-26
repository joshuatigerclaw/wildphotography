/**
 * API Key auth + usage tracking helper
 * Validates Bearer token against api_keys table, checks quota, increments usage.
 * Returns { authorized: true, customer } or { authorized: false, status, message }
 */

import { getAdminClient } from '@/lib/admin/db';
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

export type AuthenticatedCustomer = {
  customerId: number;
  email: string;
  planId: string;
  planName: string;
  monthlyLimit: number;
  yearMonth: string; // '2026-05'
};

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function validateApiKey(
  req: NextRequest
): Promise<{ authorized: true; customer: AuthenticatedCustomer } | { authorized: false; status: number; message: string }> {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { authorized: false, status: 401, message: 'Missing or invalid Authorization header. Expected: Bearer wpa_...' };
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith('wpa_') || rawKey.length < 40) {
    return { authorized: false, status: 401, message: 'Invalid API key format.' };
  }

  const keyHash = hashApiKey(rawKey);
  const client = getAdminClient();

  try {
    await client.connect();

    // Look up key
    const keyRes = await client.query(
      `SELECT k.id AS key_id, k.customer_id, k.status AS key_status,
              c.email, c.plan_id, c.plan_name, c.monthly_call_limit, c.status AS customer_status
       FROM api_keys k
       JOIN api_customers c ON c.id = k.customer_id
       WHERE k.key_hash = $1`,
      [keyHash]
    );

    if (!keyRes.rows.length) {
      return { authorized: false, status: 401, message: 'Invalid API key.' };
    }

    const row = keyRes.rows[0];

    if (row.key_status !== 'active') {
      return { authorized: false, status: 401, message: 'API key has been revoked.' };
    }

    if (row.customer_status !== 'active') {
      return { authorized: false, status: 403, message: 'Account is not active. Please contact support.' };
    }

    // Get current usage
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const usageRes = await client.query(
      `SELECT call_count FROM api_monthly_usage WHERE customer_id = $1 AND period_yyyymm = $2`,
      [row.customer_id, yearMonth]
    );

    const currentUsage = usageRes.rows[0]?.call_count || 0;

    if (currentUsage >= row.monthly_call_limit) {
      return {
        authorized: false,
        status: 429,
        message: `Monthly limit reached (${row.monthly_call_limit} calls/month). Resets on the 1st of next month.`,
      };
    }

    // Update last_used_at
    await client.query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [row.key_id]
    );

    // Increment usage counter (upsert)
    await client.query(
      `INSERT INTO api_monthly_usage (customer_id, api_key_id, period_yyyymm, calls_used)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (customer_id, period_yyyymm)
       DO UPDATE SET calls_used = api_monthly_usage.calls_used + 1, updated_at = NOW()`,
      [row.customer_id, row.key_id, yearMonth]
    );

    return {
      authorized: true,
      customer: {
        customerId: row.customer_id,
        email: row.email,
        planId: row.plan_id,
        planName: row.plan_name,
        monthlyLimit: row.monthly_call_limit,
        yearMonth,
      },
    };
  } catch (e) {
    console.error('API auth error:', e);
    return { authorized: false, status: 500, message: 'Internal error during authentication.' };
  } finally {
    await client.end();
  }
}