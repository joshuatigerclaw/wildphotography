#!/usr/bin/env node
/**
 * scripts/typesense-reconcile.js
 * Sync Typesense index with Neon eligibility rules.
 *
 * Eligibility:
 *   ready_for_public_render = true
 *   derivatives_complete = true
 *   is_active = true
 *
 * Usage:
 *   node scripts/typesense-reconcile.js --dry-run   # default
 *   node scripts/typesense-reconcile.js --apply      # live (requires --force if > 20% stale)
 *   node scripts/typesense-reconcile.js --apply --force  # live + skip 20% guard
 *   node scripts/typesense-reconcile.js --batch-size 1000
 */

'use strict';

const { Command } = require('commander');
const Typesense = require('typesense');
const { neon } = require('@neondatabase/serverless');

// ── Credentials ────────────────────────────────────────────────────────────────
const NEON_DB = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const TS_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_PORT = parseInt(process.env.TYPESENSE_PORT || '443', 10);
const TS_KEY  = process.env.TYPESENSE_ADMIN_KEY || 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const COLLECTION = 'photos';

// ── CLI ───────────────────────────────────────────────────────────────────────────────
const program = new Command();
program
  .option('--dry-run',      'Show what would change without making changes (default)', false)
  .option('--apply',         'Actually apply changes to Typesense',                  false)
  .option('--force',        'Skip the 20% stale guard',                          false)
  .option('--batch-size',   'Upsert/delete batch size (default 500)',              500)
  .option('--stale-limit',  'Percentage stale threshold that triggers --force block (default 20)', 20)
  .parse(process.argv);
const opts = program.opts();

if (opts.apply && !opts.force) {
  console.log('⚠️  Running in LIVE mode (--apply). Use --force to skip the 20% stale guard.\n');
}

// ── Typesense client ─────────────────────────────────────────────────────────
const ts = new Typesense.Client({
  nodes: [{ host: TS_HOST, port: TS_PORT, protocol: 'https' }],
  connectionTimeoutSeconds: 15,
  apiKey: TS_KEY,
});

// ── Neon ─────────────────────────────────────────────────────────────────────
const sql = neon(NEON_DB);

// ── Helpers ───────────────────────────────────────────────────────────────
function log(label, msg = '') {
  const ts_str = new Date().toISOString().slice(11, 19);
  console.log(`[${ts_str}] ${label}${msg ? ': ' + msg : ''}`);
}

function msToStr(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function fetchAllEligibleIds() {
  log('query', 'fetching eligible photo IDs from Neon…');
  const rows = await sql`
    SELECT p.id
    FROM photos p
    WHERE p.ready_for_public_render = true
      AND p.derivatives_complete = true
      AND p.is_active = true
    ORDER BY p.id
  `;
  // Convert all IDs to strings for consistent comparison with TS IDs
  return rows.map(r => String(r.id));
}

async function fetchIndexedIds() {
  log('query', 'fetching all indexed document IDs from Typesense…');
  // export() returns NDJSON string — one JSON object per line
  // Typesense may emit error messages for deleted/inaccessible docs as plain text lines
  const ndjson = await ts.collections(COLLECTION).documents().export({ include_fields: 'id' });
  const ids = [];
  for (const line of ndjson.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip Typesense error messages (plain text, not JSON)
    if (!trimmed.startsWith('{')) continue;
    try {
      ids.push(JSON.parse(trimmed).id);
    } catch {
      // skip malformed lines
    }
  }
  log('query', `fetched ${ids.length} indexed IDs from Typesense`);
  return ids;
}

async function upsertDocs(ids, batchSize) {
  const sql2 = neon(NEON_DB);
  let inserted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const numIds = batch.map(id => Number(id));
    const rows = await sql2`
      SELECT
        p.id,
        p.slug,
        p.title,
        COALESCE(p.description, '') AS description,
        COALESCE(p.keywords, '')    AS keywords,
        COALESCE(p.category, '')     AS category,
        COALESCE(p.country, '')     AS country,
        COALESCE(p.region, '')       AS region,
        COALESCE(p.location_name, '') AS location_name,
        p.thumb_url,
        p.small_url,
        p.medium_url,
        p.large_url,
        p.og_image_url,
        COALESCE(p.lat, 0)  AS lat,
        COALESCE(p.lon, 0)  AS lon,
        p.date_taken,
        COALESCE(p.popularity, 0)  AS popularity,
        COALESCE(p.gallery_id, 0)  AS gallery_id,
        COALESCE(p.gallery_slug, '') AS gallery_slug,
        p.derivatives_complete
      FROM photos p
      WHERE p.id = ANY(${numIds})
    `;

    const docs = rows.map(r => {
      const lat = typeof r.lat === 'number' ? r.lat : parseFloat(String(r.lat) || '0');
      const lon = typeof r.lon === 'number' ? r.lon : parseFloat(String(r.lon) || '0');
      const doc = {
        id:           String(r.id),
        slug:         r.slug            || '',
        title:        r.title           || ('Photo ' + r.id),
        description:  r.description     || '',
        keywords:     typeof r.keywords === 'string' ? r.keywords.trim() || '' : '',
        category:     r.category        || '',
        country:      r.country          || '',
        region:       r.region          || '',
        location_name: r.location_name   || '',
        thumb_url:    r.thumb_url       || '',
        small_url:    r.small_url       || '',
        medium_url:   r.medium_url      || '',
        large_url:    r.large_url       || '',
        og_image_url: r.og_image_url   || '',
        gallery_id:   Number(r.gallery_id) || 0,
        gallery_slug: r.gallery_slug   || '',
        popularity:   typeof r.popularity === 'number' && !isNaN(r.popularity) ? r.popularity : 0,
        derivatives_complete: Boolean(r.derivatives_complete),
      };
      if (!isNaN(lat) && lat !== 0) doc.lat = lat;
      if (!isNaN(lon) && lon !== 0) doc.lon = lon;
      if (r.date_taken) {
        const d = new Date(r.date_taken);
        if (!isNaN(d.getTime())) {
          doc.date_taken = Math.floor(d.getTime() / 1000);
        }
      }
      return doc;
    });

    const result = await ts.collections(COLLECTION).documents().import(docs, { action: 'upsert' });
    const succeeded = Array.isArray(result) ? result.filter(r => r.success).length : 0;
    inserted += succeeded;
    log('upsert', `batch ${Math.floor(i / batchSize) + 1}: ${succeeded} upserted (total ${inserted})`);
  }
  return inserted;
}

async function deleteDocs(ids, batchSize) {
  let removed = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    log('delete', `batch ${Math.floor(i / batchSize) + 1}: removing ${batch.length} stale docs…`);
    const result = await ts.collections(COLLECTION).documents().delete({
      filter_by: `id:=[${batch.join(',')}]`,
    });
    removed += result.num_deleted || 0;
    log('delete', `  → deleted ${result.num_deleted} docs`);
  }
  return removed;
}

async function getTsCount() {
  try {
    const res = await ts.collections(COLLECTION).retrieve();
    return res.num_documents;
  } catch {
    return -1;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();

  // ── Advisory lock: prevent overlapping runs ──────────────────
  const ADVISORY_LOCK_KEY = 12342;
  try {
    const lockResult = await sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS acquired`;
    if (!lockResult[0]?.acquired) {
      log('skip', 'Could not acquire advisory lock — another instance is running. Exiting.');
      process.exit(0);
    }
    log('info', '🔒 Advisory lock acquired');
  } catch (e) {
    log('warn', 'Advisory lock check failed (continuing anyway): ' + e.message);
  }


  let exitCode = 0;

  log('start', `Typesense reconciliation (mode: ${opts.apply ? 'LIVE' : 'DRY-RUN'})`);

  // Step 1: Fetch eligible IDs (strings) from Neon
  const eligibleIds = await fetchAllEligibleIds();
  const eligibleSet = new Set(eligibleIds);
  log('eligible', `${eligibleIds.length} photos eligible in Neon`);

  // Step 2: Fetch indexed IDs (strings) from Typesense
  const indexedIds = await fetchIndexedIds();
  const indexedSet  = new Set(indexedIds);
  log('indexed',  `${indexedIds.length} documents currently in Typesense`);

  // Step 3: Compute diff — all IDs are strings at this point
  const staleInTs   = indexedIds.filter(id => !eligibleSet.has(id));  // in TS, not eligible
  const missingInTs = eligibleIds.filter(id => !indexedSet.has(id)); // in Neon, not in TS

  log('diff', `missing from Typesense: ${missingInTs.length}  |  stale in Typesense: ${staleInTs.length}`);

  // Step 4: Safety guard
  const stalePct = indexedIds.length > 0
    ? (staleInTs.length / indexedIds.length) * 100
    : 0;

  log('safety', `stale percentage: ${stalePct.toFixed(2)}% (threshold: ${opts.staleLimit}%)`);

  if (stalePct > opts.staleLimit && !opts.force) {
    log('abort', `Refusing to delete ${staleInTs.length} stale docs (${stalePct.toFixed(1)}% of collection) without --force flag.`);
    log('abort', 'Run with --force to override, or run a reindex instead to rebuild cleanly.');
    console.log('\n⚠️  ABORTED — too many stale documents. Use one of:');
    console.log('  node scripts/typesense-reconcile.js --apply --force');
    console.log('  node scripts/reindex-search-ready.js   # full reindex (slower but clean rebuild)');
    exitCode = 1;
    process.exit(exitCode);
  }

  // Step 5: Apply or report
  if (opts.apply) {
    log('action', 'Applying reconciliation…');

    let inserted = 0;
    let removed  = 0;

    if (missingInTs.length > 0) {
      inserted = await upsertDocs(missingInTs, opts.batchSize);
      log('done', `inserted ${inserted} missing documents`);
    } else {
      log('done', 'no missing documents to insert');
    }

    if (staleInTs.length > 0) {
      removed = await deleteDocs(staleInTs, opts.batchSize);
      log('done', `removed ${removed} stale documents`);
    } else {
      log('done', 'no stale documents to remove');
    }

    const finalTsCount = await getTsCount();
    const finalDrift = Math.abs(finalTsCount - eligibleIds.length);
    const finalDriftPct = eligibleIds.length > 0
      ? (finalDrift / eligibleIds.length) * 100
      : 0;

    const elapsed = Date.now() - startTime;

    console.log('\n─────────────────────────────────────────────');
    console.log('  RECONCILIATION COMPLETE (LIVE)');
    console.log('─────────────────────────────────────────────');
    console.log(`  eligible count      : ${eligibleIds.length.toLocaleString()}`);
    console.log(`  final TS count     : ${finalTsCount.toLocaleString()}`);
    console.log(`  inserted           : ${inserted.toLocaleString()}`);
    console.log(`  removed (stale)    : ${removed.toLocaleString()}`);
    console.log(`  new drift          : ${finalDrift.toLocaleString()} docs (${finalDriftPct.toFixed(3)}%)`);
    console.log(`  execution time     : ${msToStr(elapsed)}`);
    console.log('─────────────────────────────────────────────\n');
  } else {
    console.log('\n─────────────────────────────────────────────');
    console.log('  RECONCILIATION REPORT (DRY-RUN)');
    console.log('─────────────────────────────────────────────');
    console.log(`  eligible count     : ${eligibleIds.length.toLocaleString()}`);
    console.log(`  indexed count      : ${indexedIds.length.toLocaleString()}`);
    console.log(`  missing in TS      : ${missingInTs.length.toLocaleString()}`);
    console.log(`  stale in TS        : ${staleInTs.length.toLocaleString()}`);
    console.log(`  drift              : ${(indexedIds.length - eligibleIds.length).toLocaleString()} docs`);
    console.log(`  stale % of TS      : ${stalePct.toFixed(3)}%`);
    console.log('');
    console.log('  Actions (DRY-RUN — no changes made):');
    if (missingInTs.length > 0) {
      console.log(`    INSERT ${missingInTs.length} missing documents`);
    }
    if (staleInTs.length > 0) {
      console.log(`    DELETE ${staleInTs.length} stale documents`);
    }
    if (missingInTs.length === 0 && staleInTs.length === 0) {
      console.log('    ✓ Typesense is fully in sync');
    }
    console.log('─────────────────────────────────────────────\n');
    console.log('  To apply: node scripts/typesense-reconcile.js --apply');
    if (staleInTs.length > 0 && stalePct > opts.staleLimit) {
      console.log(`\n  ⚠️  WARNING: stale docs (${stalePct.toFixed(1)}%) exceed ${opts.staleLimit}% threshold.`);
      console.log('  You must use --force to delete in live mode.');
    }
  }

  log('done', `exiting (mode: ${opts.apply ? 'LIVE' : 'DRY-RUN'}, elapsed: ${msToStr(Date.now() - startTime)})`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error('\n[x] Fatal error:', err.message);
  process.exit(1);
});
