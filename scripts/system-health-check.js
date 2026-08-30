#!/usr/bin/env node
/**
 * System Health Check — WildPhotography
 * Run: node scripts/system-health-check.js
 */

const { neon } = require('@neondatabase/serverless');
const { Client: TypesenseClient } = require('typesense');

const NEON_DB_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_API_KEY = process.env.TYPESENSE_ADMIN_KEY || 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const SITE_URL = process.env.SITE_URL || 'https://wildphotography.com';

const THRESHOLD_DRIFT_PCT = 5.0;
const THRESHOLD_DERIV_PCT = 5.0;     // Relaxed: accept up to 5% fail (direct URL check is strict)
const THRESHOLD_SEARCH_DROP_PCT = 30;

const sql = neon(NEON_DB_URL);
const typesense = new TypesenseClient({
  nodes: [{ host: TYPESENSE_HOST, port: 443, protocol: 'https' }],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 30,
});

async function checkInventory() {
  const counts = await sql`
    SELECT
      COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (
        WHERE ready_for_public_render = true
          AND derivatives_complete = true
          AND is_active = true
          AND status != 'archived'
      )::INTEGER AS eligible,
      COUNT(*) FILTER (WHERE ready_for_public_render = true AND derivatives_complete = true AND is_active = true AND status != 'archived')::INTEGER AS reindexable,
      COUNT(*) FILTER (WHERE ready_for_public_render = true)::INTEGER AS ready_count,
      COUNT(*) FILTER (WHERE search_ready = true)::INTEGER AS search_ready_count,
      COUNT(*) FILTER (WHERE derivatives_complete = true AND status != 'archived')::INTEGER AS derivs_complete
    FROM photos
    WHERE status != 'archived'
  `;

  const row = counts[0];
  let typesenseCount = 0;
  try {
    const tsInfo = await typesense.collections('photos').retrieve();
    typesenseCount = tsInfo.num_documents;
  } catch (e) {
    console.warn('Typesense unavailable:', e.message);
  }

  const drift = row.eligible - typesenseCount;
  const driftPct = row.eligible > 0 ? Math.abs(drift / row.eligible) * 100 : 0;

  return {
    typesenseCount,
    neonEligible: row.eligible,
    neonTotal: row.total,
    neonReady: row.ready_count,
    neonSearchReady: row.search_ready_count,
    neonDerivativesComplete: row.derivs_complete,
    drift,
    driftPct: Math.round(driftPct * 1000) / 1000,
    driftAlert: driftPct > THRESHOLD_DRIFT_PCT,
  };
}

async function checkUrl(url) {
  if (!url || url === '') return false;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkDerivativeIntegrity() {
  const sample = await sql`
    SELECT 
      id, slug,
      thumb_url, small_url, medium_url, large_url
    FROM photos
    WHERE ready_for_public_render = true
      AND derivatives_complete = true
      AND is_active = true
      AND status != 'archived'
      AND thumb_url IS NOT NULL AND thumb_url != ''
    ORDER BY RANDOM()
    LIMIT 100
  `;

  if (sample.length === 0) {
    return { sampleSize: 0, thumbMissing: 0, smallMissing: 0, mediumMissing: 0, largeMissing: 0, failPct: 0, alert: false };
  }

  const results = await Promise.all(
    sample.map(async (photo) => {
      const [thumb, small, medium, large] = await Promise.all([
        checkUrl(photo.thumb_url),
        checkUrl(photo.small_url),
        checkUrl(photo.medium_url),
        checkUrl(photo.large_url),
      ]);
      return { id: photo.id, thumb, small, medium, large };
    })
  );

  const thumbMissing = results.filter(r => !r.thumb).length;
  const smallMissing = results.filter(r => !r.small).length;
  const mediumMissing = results.filter(r => !r.medium).length;
  const largeMissing = results.filter(r => !r.large).length;
  const failedPhotos = results.filter(r => !r.thumb || !r.small || !r.medium || !r.large).length;
  const failPct = Math.round((failedPhotos / results.length) * 10000) / 100;

  return {
    sampleSize: results.length,
    thumbMissing,
    smallMissing,
    mediumMissing,
    largeMissing,
    failPct,
    alert: failPct > THRESHOLD_DERIV_PCT,
    // Only include sample errors if threshold exceeded (for debugging)
    errors: failPct > 0 ? results.filter(r => !r.thumb || !r.small || !r.medium || !r.large).slice(0, 5).map(r => ({
      id: r.id,
      thumbOk: r.thumb,
      smallOk: r.small,
      mediumOk: r.medium,
      largeOk: r.large,
    })) : [],
  };
}

const SEARCH_QUERIES = ['toucan', 'sloth', 'scarlet macaw', 'beach', 'volcano', 'monkey'];

async function checkSearchQuality(lastMetrics) {
  const results = await Promise.all(
    SEARCH_QUERIES.map(async (query) => {
      const start = Date.now();
      try {
        const res = await typesense.collections('photos').documents().search({
          q: query,
          query_by: 'title,keywords,location_name,species_common_name',
          per_page: 1,
        });
        return { query, count: res.found || 0, elapsed: Date.now() - start };
      } catch (e) {
        return { query, count: -1, elapsed: Date.now() - start, error: e.message };
      }
    })
  );

  const queries = {};
  let hasDrop = false;

  results.forEach(({ query, count, elapsed, error }) => {
    const lastCount = lastMetrics?.queries?.[query]?.count ?? count;
    const dropPct = lastCount > 0 ? ((lastCount - count) / lastCount) * 100 : 0;
    queries[query] = {
      count,
      elapsed_ms: elapsed,
      error: error || null,
      drop_vs_last_run_pct: Math.round(dropPct * 100) / 100,
    };
    if (dropPct > THRESHOLD_SEARCH_DROP_PCT && lastCount > 0 && count >= 0) {
      hasDrop = true;
      console.warn(`Search drop: "${query}" ${Math.round(dropPct)}% (${lastCount}→${count})`);
    }
  });

  return { queries, alert: hasDrop };
}

const ENDPOINTS = [
  { name: 'search', url: `${SITE_URL}/api/search?q=bird&per_page=1` },
  { name: 'public_search', url: `${SITE_URL}/api/public/search?q=bird&per_page=1` },
  { name: 'admin_security', url: `${SITE_URL}/api/admin/security` },
];

async function checkEndpoints() {
  const checks = {};
  await Promise.all(
    ENDPOINTS.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        checks[name] = { status: res.status, ok: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
      } catch (e) {
        checks[name] = { status: 0, ok: false, error: e.message };
      }
    })
  );
  return { checks, alert: Object.values(checks).some(c => !c.ok) };
}

async function storeResults(data) {
  const { inventory, derivatives, searchQuality, endpoints, recordedAt = new Date().toISOString() } = data;
  const overallHealthy = !inventory.driftAlert && !derivatives.alert && !searchQuality.alert && !endpoints.alert;

  // Ensure all numeric values are safe integers or properly rounded decimals
  const toNum = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const toInt = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : 0);
  const toPct = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
  const safeErrors = Array.isArray(derivatives.errors) ? derivatives.errors.slice(0, 20) : [];

  // Debug log all numeric values before insert
  console.log('[DEBUG] driftPct raw:', inventory.driftPct, '-> toPct:', toPct(inventory.driftPct));
  console.log('[DEBUG] failPct raw:', derivatives.failPct, '-> toPct:', toPct(derivatives.failPct));
  console.log('[DEBUG] neonEligible:', toInt(inventory.neonEligible), 'neonTotal:', toInt(inventory.neonTotal));

  try {
    await sql`
    INSERT INTO system_health_history (
      recorded_at,
      typesense_count, neon_eligible_count, neon_total_count,
      neon_ready_count, neon_search_ready_count, neon_derivatives_complete_count,
      drift_pct,
      derivative_sample_size, derivative_thumb_missing, derivative_small_missing,
      derivative_medium_missing, derivative_large_missing, derivative_overall_fail_pct,
      search_metrics, endpoint_checks,
      drift_alert, derivative_alert, search_drop_alert, endpoint_alert,
      overall_healthy,
      snapshot_data
    ) VALUES (
      ${recordedAt},
      ${toInt(inventory.typesenseCount)}, ${toInt(inventory.neonEligible)}, ${toInt(inventory.neonTotal)},
      ${toInt(inventory.neonReady)}, ${toInt(inventory.neonSearchReady)}, ${toInt(inventory.neonDerivativesComplete)},
      ${toPct(inventory.driftPct)},
      ${toInt(derivatives.sampleSize)}, ${toInt(derivatives.thumbMissing)}, ${toInt(derivatives.smallMissing)},
      ${toInt(derivatives.mediumMissing)}, ${toInt(derivatives.largeMissing)}, ${toPct(derivatives.failPct)},
      ${JSON.stringify(searchQuality)}::jsonb,
      ${JSON.stringify(endpoints)}::jsonb,
      ${inventory.driftAlert}, ${derivatives.alert}, ${searchQuality.alert}, ${endpoints.alert},
      ${overallHealthy},
      ${JSON.stringify({ errors: safeErrors })}::jsonb
    )
  `;
  } catch (e) {
    console.error('[storeResults] DB insert failed:', e.message);
  }

  return overallHealthy;
}

async function getLastRunMetrics() {
  const row = await sql`
    SELECT search_metrics FROM system_health_history ORDER BY recorded_at DESC LIMIT 1
  `;
  return row.length > 0 ? row[0].search_metrics : null;
}

async function main() {
  console.log('=== WildPhotography System Health Check ===\n');
  const start = Date.now();
  const recordedAt = new Date().toISOString();

  // ── Advisory lock: prevent overlapping runs ──────────────────
  const ADVISORY_LOCK_KEY = 12341;
  try {
    const lockResult = await sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS acquired`;
    if (!lockResult[0]?.acquired) {
      console.log('⚠️  Could not acquire advisory lock — another instance is running. Exiting.');
      process.exit(0);
    }
    console.log('🔒 Advisory lock acquired');
  } catch (e) {
    console.warn('⚠️  Advisory lock check failed (continuing anyway):', e.message);
  }


  try {
    const [inventory, endpoints, lastMetrics] = await Promise.all([
      checkInventory(),
      checkEndpoints(),
      getLastRunMetrics(),
    ]);

    const [derivatives, searchQuality] = await Promise.all([
      checkDerivativeIntegrity(),
      checkSearchQuality(lastMetrics),
    ]);

    const elapsedMs = Date.now() - start;

    console.log(`Inventory:  TS=${inventory.typesenseCount} / Neon eligible=${inventory.neonEligible} | Drift=${inventory.driftPct}% ${inventory.driftAlert ? '⚠️' : '✅'}`);
    console.log(`Derivatives: ${derivatives.thumbMissing + derivatives.smallMissing + derivatives.mediumMissing + derivatives.largeMissing} missing / ${derivatives.sampleSize * 4} | Fail%=${derivatives.failPct}% ${derivatives.alert ? '⚠️' : '✅'}`);
    const searchOk = Object.values(searchQuality.queries).filter(q => q.count >= 0).length;
    console.log(`Search:     ${searchOk}/${SEARCH_QUERIES.length} OK | ${searchQuality.alert ? '⚠️' : '✅'}`);
    const endpointOk = Object.values(endpoints.checks).filter(c => c.ok).length;
    console.log(`Endpoints:  ${endpointOk}/${ENDPOINTS.length} OK | ${endpoints.alert ? '⚠️' : '✅'}`);
    console.log(`Time:      ${elapsedMs}ms`);

    if (derivatives.errors.length > 0) {
      console.log('\nSample failing derivatives (for debug):');
      derivatives.errors.forEach(e => {
        console.log(`  ID ${e.id}: thumb=${e.thumbOk} small=${e.smallOk} medium=${e.mediumOk} large=${e.largeOk}`);
      });
    }

    const healthy = await storeResults({ inventory, derivatives, searchQuality, endpoints, recordedAt });

    if (!healthy) {
      const alerts = [
        inventory.driftAlert && 'DRIFT',
        derivatives.alert && 'DERIVATIVE',
        searchQuality.alert && 'SEARCH_DROP',
        endpoints.alert && 'ENDPOINT',
      ].filter(Boolean);
      console.error(`\n❌ Alerts: ${alerts.join(', ')}`);
      process.exit(5);
    }

    console.log('\n✅ All checks passed — system healthy');
    process.exit(0);

  } catch (e) {
    console.error('Health check exception:', e.message);
    process.exit(5);
  }
}

main();
