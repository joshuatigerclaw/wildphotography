import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { d1Query } from '@/lib/d1';

export const dynamic = 'force-dynamic';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// POST /api/account/me — lookup account by raw API key (D1 only)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawKey: string = body.api_key || '';

  if (!rawKey.startsWith('wpa_') || rawKey.length < 40) {
    return NextResponse.json({ error: 'Invalid API key format.' }, { status: 401 });
  }

  const keyHash = hashKey(rawKey);
  const now = new Date();
  const yearMonthInt = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;

  const row = await d1Query<{
    key_id: number;
    customer_id: number;
    key_prefix: string;
    key_status: string;
    email: string;
    name: string;
    company: string;
    plan_id: string;
    plan_name: string;
    monthly_call_limit: number;
    customer_status: string;
    last_used_at: string | null;
    calls_used: number;
  }>(
    `SELECT k.id AS key_id, k.customer_id, k.key_prefix, k.status AS key_status,
            c.email, c.name, c.company, c.plan_id, c.plan_name,
            c.monthly_call_limit, c.status AS customer_status,
            k.last_used_at,
            COALESCE(u.calls_used, 0) AS calls_used
     FROM api_keys k
     JOIN api_customers c ON c.id = k.customer_id
     LEFT JOIN api_monthly_usage u ON u.customer_id = c.id AND u.period_yyyymm = ?
     WHERE k.key_hash = ?`,
    [yearMonthInt, keyHash]
  );

  if (!row) {
    return NextResponse.json(
      { error: 'API key not found. Check that it starts with wpa_ and try again.' },
      { status: 401 }
    );
  }

  if (row.key_status !== 'active') {
    return NextResponse.json({ error: 'This API key has been revoked.' }, { status: 401 });
  }
  if (row.customer_status !== 'active') {
    return NextResponse.json({ error: 'Account is inactive. Contact support.' }, { status: 403 });
  }

  return NextResponse.json({
    customer: {
      id: row.customer_id,
      email: row.email,
      name: row.name,
      company: row.company,
      plan_id: row.plan_id,
      plan_name: row.plan_name,
      monthly_call_limit: row.monthly_call_limit,
      status: row.customer_status,
      key_prefix: row.key_prefix,
      key_status: row.key_status,
      last_used_at: row.last_used_at,
      calls_used: row.calls_used,
    },
  });
}
