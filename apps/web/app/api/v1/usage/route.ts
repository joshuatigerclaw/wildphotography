/**
 * GET /api/v1/usage
 * 
 * Returns current usage stats for the authenticated API key.
 * 
 * Headers:
 *   X-API-Key: <key>
 * 
 * Returns:
 *   monthly_limit, used_this_month, remaining_calls, reset_date, plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate, formatUsageHeaders } from '../_lib/auth';

export async function GET(req: NextRequest) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  return NextResponse.json(
    {
      plan: auth.planSlug,
      monthly_limit: auth.monthlyLimit,
      used_this_month: auth.usedThisMonth,
      remaining_calls: auth.remainingCalls,
      reset_date: getNextMonthStart(),
    },
    { headers: formatUsageHeaders(auth) }
  );
}

function getNextMonthStart(): string {
  const now = new Date();
  const nextMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
}