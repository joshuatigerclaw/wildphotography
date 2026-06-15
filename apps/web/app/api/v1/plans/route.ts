/**
 * GET /api/v1/plans
 * 
 * Public endpoint — returns available API plans.
 * No authentication required.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const plans = await sql(`
      SELECT
        slug,
        name,
        regular_price_monthly,
        launch_price_monthly,
        monthly_call_limit,
        allowed_derivative_sizes,
        attribution_required,
        commercial_use_allowed,
        ai_agent_use_allowed,
        max_results_default,
        max_results_limit
      FROM api_plans
      WHERE active = true
      ORDER BY regular_price_monthly ASC
    `);

    const formatted = plans.map((p: any) => ({
      slug: p.slug,
      name: p.name,
      prices: {
        monthly: p.regular_price_monthly,
        launch: p.launch_price_monthly,
      },
      limits: {
        monthly_calls: p.monthly_call_limit,
        max_results_default: p.max_results_default,
        max_results_limit: p.max_results_limit,
      },
      derivative_sizes: p.allowed_derivative_sizes,
      attribution_required: p.attribution_required,
      commercial_use_allowed: p.commercial_use_allowed,
      ai_agent_use_allowed: p.ai_agent_use_allowed,
    }));

    return NextResponse.json({ plans: formatted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}