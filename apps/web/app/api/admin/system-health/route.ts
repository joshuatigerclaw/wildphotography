import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const sql = neon(DATABASE_URL);
export const dynamic = 'force-dynamic';

// GET /api/admin/system-health — return health history for the admin dashboard
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '168', 10), 336);
  const hours = Math.min(parseInt(searchParams.get('hours') || '72', 10), 672);

  try {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const records = await sql`
      SELECT
        id,
        recorded_at,
        typesense_count,
        neon_eligible_count,
        neon_total_count,
        drift_pct,
        derivative_sample_size,
        derivative_thumb_missing,
        derivative_small_missing,
        derivative_medium_missing,
        derivative_large_missing,
        derivative_overall_fail_pct,
        search_metrics,
        endpoint_checks,
        drift_alert,
        derivative_alert,
        search_drop_alert,
        endpoint_alert,
        overall_healthy
      FROM system_health_history
      WHERE recorded_at > ${cutoffTime}::timestamptz
      ORDER BY recorded_at ASC
      LIMIT ${limit}
    `;

    const summary24h = await sql`
      SELECT
        COUNT(*)::INTEGER AS total_runs,
        COUNT(*) FILTER (WHERE overall_healthy = true)::INTEGER AS healthy_runs,
        COUNT(*) FILTER (WHERE drift_alert = true)::INTEGER AS drift_alerts,
        COUNT(*) FILTER (WHERE derivative_alert = true)::INTEGER AS deriv_alerts,
        COUNT(*) FILTER (WHERE search_drop_alert = true)::INTEGER AS search_alerts,
        COUNT(*) FILTER (WHERE endpoint_alert = true)::INTEGER AS endpoint_alerts,
        AVG(drift_pct)::DECIMAL AS avg_drift_pct,
        AVG(derivative_overall_fail_pct)::DECIMAL AS avg_deriv_fail_pct,
        MAX(drift_pct)::DECIMAL AS max_drift_pct,
        MAX(derivative_overall_fail_pct)::DECIMAL AS max_deriv_fail_pct
      FROM system_health_history
      WHERE recorded_at > ${cutoff24h}::timestamptz
    `;

    return NextResponse.json({
      records,
      summary24h: summary24h[0] || null,
      generatedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (e: any) {
    console.error('system-health API error:', e.message);
    return NextResponse.json({ error: 'Internal error', message: e.message }, { status: 500 });
  }
}
