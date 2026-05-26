/**
 * API v1: Usage endpoint — check current quota usage
 * GET /api/v1/usage
 * Auth: Bearer token (wpa_...)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';
import { validateApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { customer } = auth;

  const client = getAdminClient();
  try {
    await client.connect();

    const usageRes = await client.query(
      `SELECT calls_used FROM api_monthly_usage WHERE customer_id = $1 AND period_yyyymm = $2`,
      [customer.customerId, customer.yearMonth]
    );

    const used = usageRes.rows[0]?.calls_used || 0;
    const remaining = Math.max(0, customer.monthlyLimit - used);

    return NextResponse.json({
      plan: customer.planName,
      limit: customer.monthlyLimit,
      used,
      remaining,
      resetsAt: `${customer.yearMonth}-01`,
      period: customer.yearMonth,
    });
  } finally {
    await client.end();
  }
}