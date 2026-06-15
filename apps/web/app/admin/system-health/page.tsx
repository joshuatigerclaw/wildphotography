import { neon } from '@neondatabase/serverless';
import { Calendar, AlertTriangle, CheckCircle2, XCircle, Activity, Database, Search, Server } from 'lucide-react';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

async function getHealthData(hours = 168) {
  const sql = neon(DATABASE_URL);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const records = await sql`
    SELECT
      id, recorded_at,
      typesense_count, neon_eligible_count, neon_total_count,
      drift_pct,
      derivative_sample_size,
      derivative_thumb_missing, derivative_small_missing,
      derivative_medium_missing, derivative_large_missing,
      derivative_overall_fail_pct,
      search_metrics, endpoint_checks,
      drift_alert, derivative_alert, search_drop_alert, endpoint_alert,
      overall_healthy
    FROM system_health_history
    WHERE recorded_at > ${cutoff}::timestamptz
    ORDER BY recorded_at ASC
    LIMIT 168
  `;

  const summary = await sql`
    SELECT
      COUNT(*)::INTEGER AS total_runs,
      COUNT(*) FILTER (WHERE overall_healthy = true)::INTEGER AS healthy_runs,
      COUNT(*) FILTER (WHERE drift_alert = true)::INTEGER AS drift_alerts,
      COUNT(*) FILTER (WHERE derivative_alert = true)::INTEGER AS deriv_alerts,
      COUNT(*) FILTER (WHERE search_drop_alert = true)::INTEGER AS search_alerts,
      COUNT(*) FILTER (WHERE endpoint_alert = true)::INTEGER AS endpoint_alerts,
      AVG(drift_pct)::DECIMAL AS avg_drift_pct,
      AVG(derivative_overall_fail_pct)::DECIMAL AS avg_deriv_fail_pct,
      MAX(drift_pct)::DECIMAL AS max_drift_pct
    FROM system_health_history
    WHERE recorded_at > ${cutoff24h}::timestamptz
  `;

  return { records, summary: summary[0] };
}

async function getNeonCostStats() {
  const sql = neon(DATABASE_URL);
  const [tables, secLog24h, healthRuns24h] = await Promise.all([
    sql`SELECT
      (SELECT count(*)::int FROM photos) AS photo_count,
      (SELECT count(*)::int FROM galleries) AS gallery_count,
      (SELECT count(*)::int FROM locations) AS location_count,
      (SELECT count(*)::int FROM content_articles) AS article_count,
      (SELECT coalesce(sum(visit_count)::int, 0) FROM photo_visit_daily WHERE day >= CURRENT_DATE - 1) AS visits_24h,
      (SELECT count(*)::int FROM request_security_log WHERE created_at > NOW() - INTERVAL '24 hours') AS security_logs_24h,
      (SELECT count(*)::int FROM system_health_history WHERE recorded_at > NOW() - INTERVAL '24 hours') AS health_runs_24h
    `,
    sql`SELECT count(*)::int FROM request_security_log WHERE created_at > NOW() - INTERVAL '24 hours'`,
    sql`SELECT count(*)::int FROM system_health_history WHERE recorded_at > NOW() - INTERVAL '24 hours'`,
  ]);
  return {
    photoCount: tables[0]?.photo_count ?? 0,
    galleryCount: tables[0]?.gallery_count ?? 0,
    locationCount: tables[0]?.location_count ?? 0,
    articleCount: tables[0]?.article_count ?? 0,
    visits24h: tables[0]?.visits_24h ?? 0,
    securityLogs24h: tables[0]?.security_logs_24h ?? 0,
    healthRuns24h: tables[0]?.health_runs_24h ?? 0,
  };
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function DriftBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span className="badge-ok">0.00%</span>;
  if (pct <= 0.5) return <span className="badge-warn">{Number(pct).toFixed(2)}%</span>;
  return <span className="badge-alert">{Number(pct).toFixed(2)}%</span>;
}

function EndpointStatus({ name, check }: { name: string; check: { ok: boolean; status: number; error?: string } }) {
  return (
    <div className={`endpoint-row ${check.ok ? 'ok' : 'fail'}`}>
      <span className="endpoint-name">{name}</span>
      <span className={`endpoint-status ${check.ok ? 'ok' : 'fail'}`}>
        {check.ok
          ? <><CheckCircle2 size={14} /> {check.status}</>
          : <><XCircle size={14} /> {check.status} {check.error ? `- ${check.error.slice(0, 30)}` : ''}</>
        }
      </span>
    </div>
  );
}

export default async function SystemHealthPage() {
  let data: Awaited<ReturnType<typeof getHealthData>> | null = null;
  let error: string | null = null;

  try {
    data = await getHealthData();
  } catch (e: any) {
    error = e.message;
  }

  // Neon cost stats — non-blocking, best-effort
  let neonCost: { photoCount: number; galleryCount: number; locationCount: number; articleCount: number; visits24h: number; securityLogs24h: number; healthRuns24h: number } | null = null;
  try { neonCost = await getNeonCostStats(); } catch (_) {}

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>System Health</h1>
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <div>
            Failed to load health data: {error}
            <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
              Run <code>node scripts/system-health-check.js</code> to populate the table.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const records = (data && data.records) || [];
  const summary = (data && data.summary) || null;
  const latest = records.length > 0 ? records[records.length - 1] : null;

  const pct = (n: number | null | unknown, dec = 2) =>
    n != null ? Number(n).toFixed(dec) : '—';

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px' }}>
      <style>{`
        .page-header { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
        .page-title { font-size:24px; font-weight:600; }
        .page-subtitle { font-size:13px; color:#6b7280; }
        .summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:24px; }
        .summary-card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; }
        .summary-label { font-size:11px; text-transform:uppercase; color:#6b7280; letter-spacing:.05em; margin-bottom:4px; }
        .summary-value { font-size:28px; font-weight:700; }
        .summary-meta { font-size:11px; color:#9ca3af; margin-top:2px; }
        .card { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:20px; }
        .card-title { font-size:14px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        @media(max-width:768px){ .grid-2{ grid-template-columns:1fr; } }
        .badge-ok{ background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:9999px; font-size:12px; font-weight:600; }
        .badge-warn{ background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:9999px; font-size:12px; font-weight:600; }
        .badge-alert{ background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:9999px; font-size:12px; font-weight:600; }
        .alert{ display:flex; align-items:flex-start; gap:10px; padding:12px 16px; border-radius:6px; font-size:14px; }
        .alert-error{ background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
        .alert-warn{ background:#fef3c7; color:#92400e; border:1px solid #fcd34d; }
        .alert-ok{ background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
        .endpoint-row{ display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f3f4f6; }
        .endpoint-row:last-child{ border-bottom:none; }
        .endpoint-name{ font-family:monospace; font-size:13px; }
        .endpoint-status{ display:flex; align-items:center; gap:4px; font-size:12px; font-family:monospace; }
        .endpoint-status.ok{ color:#065f46; }
        .endpoint-status.fail{ color:#991b1b; }
        table{ width:100%; border-collapse:collapse; font-size:13px; }
        th{ text-align:left; padding:8px 10px; border-bottom:2px solid #e5e7eb; font-size:11px; text-transform:uppercase; color:#6b7280; letter-spacing:.05em; }
        td{ padding:8px 10px; border-bottom:1px solid #f3f4f6; }
        tr:hover td{ background:#fafafa; }
        .tr-alert td{ background:#fff5f5; }
        .empty{ text-align:center; color:#9ca3af; padding:40px; font-size:14px; }
        .trend{ font-size:11px; padding:2px 6px; border-radius:4px; }
        .trend-up{ background:#fee2e2; color:#991b1b; }
        .trend-down{ background:#d1fae5; color:#065f46; }
        .trend-stable{ background:#f3f4f6; color:#6b7280; }
      `}</style>

      <div className="page-header">
        <Activity size={28} />
        <div>
          <div className="page-title">System Health</div>
          <div className="page-subtitle">WildPhotography · auto-runs every 6 hours · <a href="/admin/system-health">Refresh</a></div>
        </div>
      </div>

      {latest ? (
        <div className={`alert ${latest.overall_healthy ? 'alert-ok' : 'alert-error'}`} style={{ marginBottom: 20 }}>
          {latest.overall_healthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>
            {latest.overall_healthy ? 'All systems healthy' : '⚠️ Alerts active — see details below'}
            {' '}· Last check: {formatTs(latest.recorded_at)}
          </span>
        </div>
      ) : (
        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          <AlertTriangle size={16} />
          <span>No records yet. Run <code>node scripts/system-health-check.js</code> to populate.</span>
        </div>
      )}

      {summary && summary.total_runs > 0 && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Health Score (24h)</div>
            <div className="summary-value">{Math.round((Number(summary.healthy_runs) / Number(summary.total_runs)) * 100)}%</div>
            <div className="summary-meta">{String(summary.total_runs)} runs recorded</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Drift (24h avg)</div>
            <div className="summary-value">{pct(summary.avg_drift_pct, 3)}%</div>
            <div className="summary-meta">Max: {pct(summary.max_drift_pct, 3)}% · {String(summary.drift_alerts)} alerts</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Derivative Fail (24h avg)</div>
            <div className="summary-value">{pct(summary.avg_deriv_fail_pct)}%</div>
            <div className="summary-meta">{String(summary.deriv_alerts)} alerts</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Alerts (24h)</div>
            <div className="summary-value">{String(summary.search_alerts + summary.endpoint_alerts)}</div>
            <div className="summary-meta">{String(summary.endpoint_alerts)} endpoint · {String(summary.search_alerts)} search</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><Database size={16} />Inventory Consistency</div>
          {latest ? (
            <table>
              <thead><tr><th>Metric</th><th>Value</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td>Typesense indexed</td><td><strong>{Number(latest.typesense_count).toLocaleString()}</strong></td><td rowSpan={3} style={{ verticalAlign: 'middle', textAlign: 'center' }}><DriftBadge pct={Number(latest.drift_pct)} /></td></tr>
                <tr><td>Neon eligible</td><td><strong>{Number(latest.neon_eligible_count).toLocaleString()}</strong></td></tr>
                <tr><td>Neon total</td><td>{Number(latest.neon_total_count).toLocaleString()}</td></tr>
                <tr><td>Drift</td><td>{Number(latest.drift_pct).toFixed(3)}%</td></tr>
                <tr><td>Derivs complete</td><td>{Number(latest.neon_derivatives_complete_count).toLocaleString()}</td></tr>
                <tr><td>Search ready</td><td>{Number(latest.neon_search_ready_count).toLocaleString()}</td></tr>
              </tbody>
            </table>
          ) : <div className="empty">No data</div>}
        </div>

        <div className="card">
          <div className="card-title"><Server size={16} />Derivative Integrity ({latest ? String(latest.derivative_sample_size) + ' sampled' : '—'})</div>
          {latest ? (
            <table>
              <thead><tr><th>Derivative</th><th>Missing</th><th>Rate</th></tr></thead>
              <tbody>
                {[
                  { key: 'thumb_url', val: Number(latest.derivative_thumb_missing) },
                  { key: 'small_url', val: Number(latest.derivative_small_missing) },
                  { key: 'medium_url', val: Number(latest.derivative_medium_missing) },
                  { key: 'large_url', val: Number(latest.derivative_large_missing) },
                ].map(({ key, val }) => {
                  const rate = ((val / Number(latest.derivative_sample_size)) * 100).toFixed(1);
                  return (
                    <tr key={key}>
                      <td><code>{key}</code></td>
                      <td style={{ color: val > 0 ? '#ef4444' : '#065f46', fontWeight: 600 }}>{val}</td>
                      <td style={{ color: Number(rate) > 1 ? '#ef4444' : '#065f46' }}>{rate}%</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600 }}>Overall fail rate</td>
                  <td style={{ fontWeight: 700, color: Number(latest.derivative_overall_fail_pct) > 1 ? '#ef4444' : '#065f46' }}>
                    {Number(latest.derivative_overall_fail_pct).toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          ) : <div className="empty">No data</div>}
        </div>
      </div>

      {neonCost ? (
        <div className="card">
          <div className="card-title"><Database size={16} />Neon Cost Snapshot · Last 24h</div>
          <table>
            <thead><tr><th>Metric</th><th>Count</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td>Photos</td><td><strong>{neonCost.photoCount.toLocaleString()}</strong></td><td>Total in database</td></tr>
              <tr><td>Galleries</td><td><strong>{neonCost.galleryCount.toLocaleString()}</strong></td><td>Total in database</td></tr>
              <tr><td>Locations</td><td><strong>{neonCost.locationCount.toLocaleString()}</strong></td><td>Total in database</td></tr>
              <tr><td>Articles</td><td><strong>{neonCost.articleCount.toLocaleString()}</strong></td><td>Total in database</td></tr>
              <tr><td>Photo visits</td><td style={{ color: neonCost.visits24h > 500000 ? '#ef4444' : '#065f46', fontWeight: 600 }}>{neonCost.visits24h.toLocaleString()}</td><td>Deferred via waitUntil (background); aggregate = photo_visit_daily</td></tr>
              <tr><td>Security log writes</td><td style={{ color: neonCost.securityLogs24h > 10000 ? '#ef4444' : '#065f46', fontWeight: 600 }}>{neonCost.securityLogs24h.toLocaleString()}</td><td>High count = slow query risk</td></tr>
              <tr><td>Health check runs</td><td>{neonCost.healthRuns24h.toLocaleString()}</td><td>4/day expected; more = overlapping jobs</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
            Cost drivers: photo_visit_daily upserts (now deferred via waitUntil), security_log writes (background), system_health_history writes, and on-demand page Neon calls. Use ISR (revalidate) on public pages to reduce wakeups.
          </p>
        </div>
      ) : null}

      {latest && latest.search_metrics ? (
        <div className="card">
          <div className="card-title"><Search size={16} />Search Quality · Last Run</div>
          <table>
            <thead>
              <tr><th>Query</th><th>Results</th><th>Response</th><th>Trend</th><th>Status</th></tr>
            </thead>
            <tbody>
              {Object.entries(latest.search_metrics as Record<string, any>).map(([query, q]: [string, any]) => {
                const drop = Number(q.drop_vs_last_run_pct || 0);
                return (
                  <tr key={query} className={q.error ? 'tr-alert' : ''}>
                    <td><code>{query}</code></td>
                    <td style={{ fontWeight: 600 }}>{q.count >= 0 ? q.count.toLocaleString() : 'ERR'}</td>
                    <td>{q.elapsed_ms}ms</td>
                    <td>
                      {drop > 10
                        ? <span className="trend trend-up">↓ {drop}%</span>
                        : drop < -10
                        ? <span className="trend trend-down">↑ {Math.abs(drop)}%</span>
                        : <span className="trend trend-stable">→</span>
                      }
                    </td>
                    <td>{q.error ? <span className="badge-alert">ERR</span> : <span className="badge-ok">OK</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {latest && latest.endpoint_checks ? (
        <div className="card">
          <div className="card-title"><Server size={16} />Endpoints · Last Run</div>
          <div>
            {Object.entries(latest.endpoint_checks as Record<string, any>).map(([name, check]: [string, any]) => (
              <EndpointStatus key={name} name={name} check={check} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title"><Calendar size={16} />Health History ({records.length} records)</div>
        {records.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Time (CST)</th><th>TS / Eligible</th><th>Drift %</th><th>Deriv Fail %</th><th>Healthy</th><th>Alerts</th></tr>
              </thead>
              <tbody>
                {records.slice(-30).reverse().map((r: Record<string, any>) => {
                  const alerts = [
                    r.drift_alert && 'DRIFT',
                    r.derivative_alert && 'DERIV',
                    r.search_drop_alert && 'SEARCH',
                    r.endpoint_alert && 'EP',
                  ].filter(Boolean);
                  return (
                    <tr key={r.id} className={alerts.length > 0 ? 'tr-alert' : ''}>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{formatTs(r.recorded_at)}</td>
                      <td>{Number(r.typesense_count).toLocaleString()} / {Number(r.neon_eligible_count).toLocaleString()}</td>
                      <td><DriftBadge pct={Number(r.drift_pct)} /></td>
                      <td style={{ color: Number(r.derivative_overall_fail_pct) > 1 ? '#ef4444' : '#065f46' }}>
                        {Number(r.derivative_overall_fail_pct).toFixed(2)}%
                      </td>
                      <td>
                        {r.overall_healthy
                          ? <CheckCircle2 size={14} color="#065f46" />
                          : <XCircle size={14} color="#991b1b" />
                        }
                      </td>
                      <td style={{ fontSize: '12px' }}>{alerts.length > 0 ? alerts.join(', ') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No health records yet. Run the check script.</div>
        )}
      </div>
    </div>
  );
}
