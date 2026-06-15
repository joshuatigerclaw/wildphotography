import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';
import { validateApiKey } from '@/lib/api-auth';
import { d1Query } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { customer } = auth;
  const yearMonthInt = new Date().getUTCFullYear() * 100 + (new Date().getUTCMonth() + 1);

  // ── Try D1 first ────────────────────────────────────────────────────────
  const row = await d1Query<{ calls_used: number }>(
    `SELECT calls_used FROM api_monthly_usage
     WHERE customer_id = ? AND period_yyyymm = ?`,
    [customer.customerId, yearMonthInt]
  );

  const used = row?.calls_used ?? 0;
  const remaining = Math.max(0, customer.monthlyLimit - used);

  return NextResponse.json({
    plan: customer.planName,
    limit: customer.monthlyLimit,
    used,
    remaining,
    resetsAt: `${customer.yearMonth}-01`,
    period: customer.yearMonth,
  });
}
