import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { d1Query } from '@/lib/d1';

export const dynamic = 'force-dynamic';

// GET /api/v1/usage — return usage stats for the authenticated customer (D1 only)
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { customer } = auth;
  const yearMonthInt = new Date().getUTCFullYear() * 100 + (new Date().getUTCMonth() + 1);

  // Get usage + key info from D1
  const row = await d1Query<{
    calls_used: number;
    key_prefix: string;
    last_used_at: string | null;
  }>(
    `SELECT
       COALESCE(u.calls_used, 0) AS calls_used,
       k.key_prefix,
       k.last_used_at
     FROM api_keys k
     LEFT JOIN api_monthly_usage u
       ON u.customer_id = k.customer_id
      AND u.period_yyyymm = ?
     WHERE k.customer_id = ?
       AND k.status = 'active'
     LIMIT 1`,
    [yearMonthInt, customer.customerId]
  );

  const used = row?.calls_used ?? 0;
  const remaining = Math.max(0, customer.monthlyLimit - used);

  return NextResponse.json({
    customer: {
      id: customer.customerId,
      email: customer.email,
    },
    plan: customer.planName,
    limit: customer.monthlyLimit,
    used,
    remaining,
    resetsAt: `${customer.yearMonth}-01`,
    period: customer.yearMonth,
    keyPrefix: row?.key_prefix ?? null,
    lastUsedAt: row?.last_used_at ?? null,
  });
}
