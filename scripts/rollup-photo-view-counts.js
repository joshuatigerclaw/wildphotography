#!/usr/bin/env node
/**
 * scripts/rollup-photo-view-counts.js
 *
 * Aggregates photo_visit_daily totals and updates photos.views_count.
 * Replaces the per-visit views_count UPDATE that was causing hot writes.
 *
 * Usage:
 *   node scripts/rollup-photo-view-counts.js [--dry-run] [--lock]
 *
 * Run via cron every 6 hours:
 *   0 */6 * * *  node /path/to/rollup-photo-view-counts.js --lock
 *
 * Advisory lock key: 12342 (different from health-check=12341 and reconcile=12340)
 */

'use strict';

const { Client } = require('pg');

const NEON_DB = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const ADVISORY_LOCK_KEY = 12342n;

const opts = require('commander')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('--lock', 'Use advisory lock to prevent overlapping runs', false)
  .parse(process.argv())
  .opts();

async function main() {
  const client = new Client(NEON_DB);
  await client.connect();

  try {
    // ── Advisory lock ────────────────────────────────────────
    if (opts.lock) {
      const lockRes = await client.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [ADVISORY_LOCK_KEY]
      );
      if (!lockRes.rows[0]?.acquired) {
        console.log('⚠️  Could not acquire advisory lock — another instance is running. Exiting.');
        process.exit(0);
      }
      console.log('🔒 Advisory lock acquired');
    }

    // ── Aggregate daily visits per photo ─────────────────────
    const aggRes = await client.query(`
      SELECT photo_id, SUM(visit_count)::int AS total_visits
      FROM photo_visit_daily
      WHERE day >= CURRENT_DATE - 30
      GROUP BY photo_id
      HAVING SUM(visit_count) > 0
    `);

    console.log(`📊 Found ${aggRes.rows.length} photos with visits in last 30 days`);

    if (opts.dryRun) {
      console.log('DRY RUN — sample entries:');
      aggRes.rows.slice(0, 10).forEach(r => {
        console.log(`  photo_id=${r.photo_id} views_count=${r.total_visits}`);
      });
      return;
    }

    // ── Batch update photos.views_count ───────────────────────
    const BATCH_SIZE = 500;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < aggRes.rows.length; i += BATCH_SIZE) {
      const batch = aggRes.rows.slice(i, i + BATCH_SIZE);

      // Build multi-value UPDATE
      const sets = batch.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`);
      const values = batch.flatMap(r => [r.photo_id, r.total_visits]);

      const updateRes = await client.query(`
        UPDATE photos p
        SET views_count = v.new_count
        FROM (VALUES ${sets.join(', ')}) AS v(photo_id, new_count)
        WHERE p.id = v.photo_id
          AND p.views_count IS DISTINCT FROM v.new_count
      `, values);

      updated += updateRes.rowCount || 0;
    }

    console.log(`✅ Updated views_count for ${updated} photos (${aggRes.rows.length} total, ${errors} errors)`);

  } finally {
    if (opts.lock) {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
      console.log('🔓 Advisory lock released');
    }
    await client.end();
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
