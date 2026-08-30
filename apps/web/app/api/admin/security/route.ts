/**
 * Admin Security API — Phase 5
 * Returns security log data for the /admin/security dashboard.
 * All data is hashed/sanitized — no raw IPs or tokens exposed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_GonqSbJlRi71@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_SECRET;
}

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 15000 });
  try {
    await client.connect();
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}

export async function GET(request: NextRequest) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const period = searchParams.get('period') || 'today'; // today | 7d | 30d
  const endpointGroup = searchParams.get('endpoint_group') || '';
  const country = searchParams.get('country') || '';
  const asn = searchParams.get('asn') || '';
  const actionTaken = searchParams.get('action') || '';
  const minBotScore = searchParams.get('min_bot_score') || '';
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo = searchParams.get('date_to') || '';

  // Build date filter
  let dateFilter = "created_at >= NOW() - INTERVAL '1 day'";
  if (period === '7d') dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
  else if (period === '30d') dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
  else if (dateFrom) dateFilter = `created_at >= '${dateFrom}'::timestamptz`;
  if (dateTo) dateFilter += ` AND created_at <= '${dateTo}'::timestamptz + INTERVAL '1 day'`;

  const conditions = [dateFilter];
  if (endpointGroup) conditions.push(`endpoint_group = '${endpointGroup}'`);
  if (country) conditions.push(`country = '${country}'`);
  if (asn) conditions.push(`asn = '${asn}'`);
  if (actionTaken) conditions.push(`action_taken = '${actionTaken}'`);
  if (minBotScore) conditions.push(`bot_score >= ${minBotScore}`);

  const where = conditions.join(' AND ');

  try {
    // ── Summary cards ──────────────────────────────────────────
    const summary = await query<any>(`
      SELECT
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE action_taken IN ('blocked','challenge','downgraded'))::int AS suspicious_requests,
        COUNT(*) FILTER (WHERE action_taken IN ('blocked','challenge'))::int AS blocked_requests,
        COUNT(*) FILTER (WHERE action_taken IN ('blocked','challenge'))::int AS blocked_challenged,
        MAX(bot_score) AS max_bot_score,
        AVG(bot_score)::int AS avg_bot_score,
        COUNT(*) FILTER (WHERE endpoint_group LIKE 'v1_%')::int AS api_v1_requests
      FROM request_security_log
      WHERE ${where}
    `);

    // ── Top stats ──────────────────────────────────────────────
    const topStats = await query<any>(`
      SELECT
        COALESCE(endpoint_group, 'unknown') AS endpoint_group,
        COUNT(*)::int AS count
      FROM request_security_log
      WHERE ${where}
      GROUP BY endpoint_group
      ORDER BY count DESC
      LIMIT 1
    `);

    const topCountry = await query<any>(`
      SELECT country, COUNT(*)::int AS count
      FROM request_security_log
      WHERE ${where} AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 1
    `);

    const topASN = await query<any>(`
      SELECT asn, COUNT(*)::int AS count
      FROM request_security_log
      WHERE ${where} AND asn IS NOT NULL
      GROUP BY asn
      ORDER BY count DESC
      LIMIT 1
    `);

    // ── Traffic by endpoint ────────────────────────────────────
    const trafficByEndpoint = await query<any>(`
      SELECT
        COALESCE(endpoint_group, 'unknown') AS endpoint_group,
        COUNT(*)::int AS request_count,
        COUNT(*) FILTER (WHERE action_taken IN ('blocked','challenge'))::int AS blocked_count,
        COUNT(*) FILTER (WHERE action_taken IN ('downgraded'))::int AS downgraded_count,
        COALESCE(AVG(bot_score)::int, 0) AS avg_bot_score,
        MODE() WITHIN GROUP (ORDER BY country) AS top_country,
        MODE() WITHIN GROUP (ORDER BY asn) AS top_asn
      FROM request_security_log
      WHERE ${where}
      GROUP BY endpoint_group
      ORDER BY request_count DESC
      LIMIT 20
    `);

    // ── Suspicious user agents ─────────────────────────────────
    const suspiciousUA = await query<any>(`
      SELECT
        user_agent,
        user_agent_hash,
        COUNT(*)::int AS count,
        MAX(created_at)::text AS last_seen,
        MODE() WITHIN GROUP (ORDER BY action_taken) AS action_taken,
        STRING_AGG(DISTINCT reason, ', ') AS reasons
      FROM request_security_log
      WHERE ${where}
        AND (action_taken IN ('blocked','challenge','downgraded') OR bot_score >= 3)
        AND user_agent IS NOT NULL
      GROUP BY user_agent, user_agent_hash
      ORDER BY count DESC
      LIMIT 20
    `);

    // ── Country / ASN patterns ─────────────────────────────────
    const countryASN = await query<any>(`
      SELECT
        COALESCE(country, 'unknown') AS country,
        COALESCE(asn, 'unknown') AS asn,
        COUNT(*)::int AS request_count,
        COALESCE(AVG(bot_score)::int, 0) AS avg_bot_score,
        COUNT(*) FILTER (WHERE action_taken IN ('blocked','challenge','downgraded'))::int AS suspicious_count,
        MODE() WITHIN GROUP (ORDER BY endpoint_group) AS top_endpoint
      FROM request_security_log
      WHERE ${where}
        AND country IS NOT NULL AND asn IS NOT NULL
      GROUP BY country, asn
      ORDER BY request_count DESC
      LIMIT 20
    `);

    // ── API abuse candidates (high-volume IP hashes) ───────────
    const ipAbuse = await query<any>(`
      SELECT
        ip_hash,
        user_agent_hash,
        endpoint_group,
        COUNT(*)::int AS request_count,
        MAX(created_at)::text AS latest_request,
        MODE() WITHIN GROUP (ORDER BY action_taken) AS action_taken,
        STRING_AGG(DISTINCT reason, ', ') AS reasons,
        AVG(bot_score)::int AS avg_bot_score
      FROM request_security_log
      WHERE ${where}
        AND action_taken IN ('blocked','challenge','downgraded')
      GROUP BY ip_hash, user_agent_hash, endpoint_group
      HAVING COUNT(*) >= 5
      ORDER BY request_count DESC
      LIMIT 20
    `);

    // ── Recent security events ────────────────────────────────
    const recentEvents = await query<any>(`
      SELECT
        created_at::text,
        request_path,
        country,
        asn,
        user_agent,
        bot_score,
        action_taken,
        reason,
        status_code,
        response_time_ms
      FROM request_security_log
      WHERE ${where}
        AND action_taken IN ('blocked','challenge','error')
      ORDER BY created_at DESC
      LIMIT 50
    `);

    // ── Alert candidates ──────────────────────────────────────
    const alertCandidates = await query<any>(`
      SELECT
        ip_hash,
        user_agent_hash,
        endpoint_group,
        COUNT(*)::int AS request_count,
        MAX(created_at)::text AS latest_request,
        AVG(bot_score)::int AS avg_bot_score,
        STRING_AGG(DISTINCT reason, ', ') AS reasons
      FROM request_security_log
      WHERE ${where}
        AND action_taken IN ('blocked','challenge')
      GROUP BY ip_hash, user_agent_hash, endpoint_group
      HAVING COUNT(*) >= 10
      ORDER BY request_count DESC
      LIMIT 10
    `);

    return NextResponse.json({
      summary: {
        total_requests: summary[0]?.total_requests ?? 0,
        suspicious_requests: summary[0]?.suspicious_requests ?? 0,
        blocked_challenged: summary[0]?.blocked_challenged ?? 0,
        avg_bot_score: summary[0]?.avg_bot_score ?? 0,
        max_bot_score: summary[0]?.max_bot_score ?? 0,
        api_v1_requests: summary[0]?.api_v1_requests ?? 0,
        top_country: topCountry[0]?.country ?? null,
        top_asn: topASN[0]?.asn ?? null,
        top_endpoint: topStats[0]?.endpoint_group ?? null,
      },
      trafficByEndpoint,
      suspiciousUA,
      countryASN,
      ipAbuse,
      alertCandidates,
      recentEvents,
      filters: { period, endpointGroup, country, asn, actionTaken, minBotScore, dateFrom, dateTo },
    });
  } catch (error) {
    console.error('[admin/security/api] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}