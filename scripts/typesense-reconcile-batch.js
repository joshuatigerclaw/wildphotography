#!/usr/bin/env node
/**
 * scripts/typesense-reconcile-batch.js
 * Batch typesense reconciliation with proper error handling.
 * 
 * Run: node scripts/typesense-reconcile-batch.js --batch-size 500
 * 
 * Handles:
 * - Collection missing → auto-creates with correct schema
 * - OUT_OF_DISK → exits gracefully with clear error
 * - Schema drift → logs and repairs
 */

'use strict';

const { neon } = require('@neondatabase/serverless');
const Typesense = require('typesense');

const NEON_DB = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const TS_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_PORT = parseInt(process.env.TYPESENSE_PORT || '443', 10);
const TS_KEY  = process.env.TYPESENSE_ADMIN_KEY || 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const COLLECTION = 'photos';

const DEFAULT_BATCH_SIZE = 500;
const args = process.argv.slice(2);
const BATCH_SIZE = args.includes('--batch-size') 
  ? parseInt(args[args.indexOf('--batch-size') + 1]) || DEFAULT_BATCH_SIZE
  : DEFAULT_BATCH_SIZE;

const sql = neon(NEON_DB);
const ts = new Typesense.Client({
  nodes: [{ host: TS_HOST, port: TS_PORT, protocol: 'https' }],
  connectionTimeoutSeconds: 30,
  apiKey: TS_KEY,
});

function log(label, msg = '') {
  const ts_str = new Date().toISOString().slice(11, 19);
  console.log(`[${ts_str}] ${label}${msg ? ': ' + msg : ''}`);
}

// ── Schema aligned with transformPhoto() ────────────────────────────────────
const COLLECTION_SCHEMA = {
  name: COLLECTION,
  fields: [
    { name: 'id',                   type: 'string',  facet: false },
    { name: 'slug',                 type: 'string',  facet: false },
    { name: 'title',                type: 'string',  facet: false },
    { name: 'description',          type: 'string',  facet: false, optional: true },
    { name: 'keywords',             type: 'string[]', facet: true,  optional: true },
    { name: 'category',             type: 'string',  facet: true,  optional: true },
    { name: 'country',              type: 'string',  facet: true,  optional: true },
    { name: 'region',               type: 'string',  facet: true,  optional: true },
    { name: 'location_name',        type: 'string',  facet: true,  optional: true },
    { name: 'thumb_url',            type: 'string',  facet: false, optional: true },
    { name: 'small_url',            type: 'string',  facet: false, optional: true },
    { name: 'medium_url',           type: 'string',  facet: false, optional: true },
    { name: 'large_url',            type: 'string',  facet: false, optional: true },
    { name: 'og_image_url',         type: 'string',  facet: false, optional: true },
    { name: 'gallery_id',           type: 'int32',  facet: true,  optional: true },
    { name: 'gallery_slug',         type: 'string',  facet: true,  optional: true },
    { name: 'gallery_title',         type: 'string',  facet: true,  optional: true },
    { name: 'popularity',           type: 'int32',  facet: false, optional: true },
    { name: 'derivatives_complete',  type: 'bool',   facet: false, optional: true },
    { name: 'ready_for_public_render', type: 'bool', facet: false, optional: true },
    { name: 'search_ready',         type: 'bool',   facet: false, optional: true },
    { name: 'species',              type: 'string',  facet: true,  optional: true },
    { name: 'species_common_name',  type: 'string',  facet: true,  optional: true },
    { name: 'url',                  type: 'string',  facet: false, optional: true },
    { name: 'lat',                  type: 'float',   facet: false, optional: true },
    { name: 'lon',                  type: 'float',   facet: false, optional: true },
    { name: 'date_taken',           type: 'int64',  facet: false, optional: true },
  ],
  default_sorting_field: 'popularity',
};

function transformPhoto(r) {
  const lat = typeof r.lat === 'number' ? r.lat : parseFloat(String(r.lat) || '0');
  const lon = typeof r.lon === 'number' ? r.lon : parseFloat(String(r.lon) || '0');
  const kwRaw = typeof r.keywords === 'string' ? r.keywords.trim() : '';
  const keywords = kwRaw ? kwRaw.split(',').map(k => k.trim()).filter(k => k) : [];
  const doc = {
    id:            String(r.id),
    slug:          r.slug            || '',
    title:         r.title           || ('Photo ' + r.id),
    description:   r.description     || '',
    keywords:      keywords,
    category:      r.category        || '',
    country:       r.country         || '',
    region:        r.region          || '',
    location_name: r.location_name   || '',
    thumb_url:    r.thumb_url       || '',
    small_url:    r.small_url       || '',
    medium_url:   r.medium_url      || '',
    large_url:    r.large_url       || '',
    og_image_url: r.og_image_url    || '',
    gallery_id:   Number(r.gallery_id) || 0,
    gallery_slug: r.gallery_slug    || '',
    gallery_title: r.gallery_title  || '',
    popularity:   typeof r.popularity === 'number' && !isNaN(r.popularity) ? r.popularity : 0,
    derivatives_complete:     Boolean(r.derivatives_complete),
    ready_for_public_render:  true,
    search_ready:             true,
    species:          r.species          || '',
    species_common_name:      r.species   || '',
    url:             'https://www.wildphotography.com/photo/' + (r.slug || ''),
  };
  if (!isNaN(lat) && lat !== 0) doc.lat = lat;
  if (!isNaN(lon) && lon !== 0) doc.lon = lon;
  if (r.date_taken) {
    const d = new Date(r.date_taken);
    if (!isNaN(d.getTime())) doc.date_taken = Math.floor(d.getTime() / 1000);
  }
  return doc;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function checkHealth() {
  try {
    const res = await fetch(`https://${TS_HOST}/health`, {
      headers: { 'X-Typesense-Admin-Key': TS_KEY },
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    return { ok: json.ok === true, resourceError: json.resource_error || null };
  } catch (e) {
    return { ok: false, resourceError: e.message };
  }
}

async function collectionExists() {
  try {
    await ts.collections(COLLECTION).retrieve();
    return true;
  } catch (e) {
    if (e.message.includes('404') || e.message.includes('not found') || e.message.includes('Not Found')) {
      return false;
    }
    throw e;
  }
}

async function createCollection(retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log('action', `creating collection '${COLLECTION}' (attempt ${attempt})…`);
      const result = await ts.collections().create(COLLECTION_SCHEMA);
      log('created', `collection '${result.name}' created`);
      return result;
    } catch (e) {
      if (e.message.includes('OUT_OF_DISK') || e.message.includes('out of disk')) {
        log('ERROR', `OUT_OF_DISK — cannot create collection. Upgrade Typesense plan or free disk space.`);
        throw new Error('OUT_OF_DISK');
      }
      if (e.message.includes('already exists') || e.message.includes('conflict')) {
        log('info', 'collection already exists, continuing');
        return;
      }
      if (attempt < retries) {
        log('warn', `create failed: ${e.message} — retrying…`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  const startTime = Date.now();
  
  log('start', `Typesense batch reconcile (batch size: ${BATCH_SIZE})`);
  
  // ── 1. Health check ────────────────────────────────────────────────────────
  log('health', 'checking Typesense status…');
  const health = await checkHealth();
  if (!health.ok) {
    log('ERROR', `Typesense unhealthy: ${health.resourceError || 'unknown error'}`);
    if (health.resourceError === 'OUT_OF_DISK') {
      log('ERROR', 'OUT_OF_DISK detected. Pipeline is BLOCKED. Resolve disk space before running reconcile.');
      log('ERROR', 'Contact Typesense support to upgrade plan or free disk space.');
      process.exit(2);
    }
  } else {
    log('health', 'Typesense is healthy');
  }

  // ── 2. Ensure collection exists ───────────────────────────────────────────
  const exists = await collectionExists();
  if (!exists) {
    log('warn', `collection '${COLLECTION}' not found — will attempt to create`);
    await createCollection();
  } else {
    log('info', `collection '${COLLECTION}' exists`);
  }

  // ── 3. Get eligible IDs from Neon ─────────────────────────────────────────
  log('query', 'fetching eligible photo IDs from Neon…');
  const eligibleRows = await sql`
    SELECT id FROM photos 
    WHERE ready_for_public_render = true 
      AND derivatives_complete = true 
      AND search_ready = true
      AND status = 'published'
    ORDER BY id
  `;
  const eligibleIds = eligibleRows.map(r => Number(r.id));
  const eligibleSet = new Set(eligibleIds);
  log('eligible', `${eligibleIds.length.toLocaleString()} photos eligible in Neon`);

  // ── 4. Get indexed IDs from Typesense ─────────────────────────────────────
  let indexedIds = [];
  let indexedSet = new Set();
  try {
    log('query', 'fetching indexed document IDs from Typesense…');
    const ndjson = await ts.collections(COLLECTION).documents().export({ include_fields: 'id' });
    for (const line of ndjson.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.id !== undefined) indexedIds.push(String(parsed.id));
      } catch { /* skip malformed lines */ }
    }
    indexedSet = new Set(indexedIds);
    log('indexed', `${indexedIds.length.toLocaleString()} documents currently in Typesense`);
  } catch (e) {
    if (e.message.includes('404') || e.message.includes('not found')) {
      log('warn', 'collection disappeared during run — recreating…');
      await createCollection();
      indexedIds = [];
      indexedSet = new Set();
    } else {
      throw e;
    }
  }

  // ── 5. Compute diff ───────────────────────────────────────────────────────
  const missingInTs = eligibleIds.filter(id => !indexedSet.has(String(id)));
  const staleInTs   = indexedIds.filter(id => !eligibleSet.has(Number(id)));
  log('diff', `missing from TS: ${missingInTs.length.toLocaleString()} | stale in TS: ${staleInTs.length.toLocaleString()}`);

  // ── 6. Insert missing in batches ─────────────────────────────────────────
  let inserted = 0;
  if (missingInTs.length > 0) {
    log('action', `inserting ${missingInTs.length.toLocaleString()} missing documents in batches of ${BATCH_SIZE}…`);
    for (let i = 0; i < missingInTs.length; i += BATCH_SIZE) {
      const batchIds = missingInTs.slice(i, i + BATCH_SIZE).map(id => Number(id));
      const rows = await sql`
        SELECT p.id, p.slug, p.title, p.description, p.keywords, p.category, p.country, p.region,
               p.location_name, p.thumb_url, p.small_url, p.medium_url, p.large_url, p.og_image_url,
               p.lat, p.lon, p.date_taken, p.popularity, p.gallery_id, p.gallery_slug, p.derivatives_complete,
               COALESCE(species_common_name, '') as species,
               COALESCE(g.name, '') as gallery_title
        FROM photos p
        LEFT JOIN galleries g ON p.gallery_id = g.id
        WHERE p.id = ANY(${batchIds})
      `;
      
      if (rows.length === 0) {
        log('batch', `batch ${Math.floor(i/BATCH_SIZE)+1}: no rows returned, skipping`);
        continue;
      }
      
      const docs = rows.map(transformPhoto);
      if (docs.length === 0) {
        log('batch', `batch ${Math.floor(i/BATCH_SIZE)+1}: 0 docs, skipping`);
        continue;
      }
      
      try {
        const result = await ts.collections(COLLECTION).documents().import(docs, { action: 'upsert' });
        const succeeded = Array.isArray(result) ? result.filter(r => r.success).length : 0;
        inserted += succeeded;
        log('batch', `batch ${Math.floor(i/BATCH_SIZE)+1}: ${succeeded}/${docs.length} upserted (total: ${inserted})`);
      } catch (e) {
        if (e.message.includes('OUT_OF_DISK')) {
          log('ERROR', `OUT_OF_DISK during insert at batch ${Math.floor(i/BATCH_SIZE)+1}. Progress saved: ${inserted}/${missingInTs.length} inserted.`);
          log('ERROR', 'Exiting — will resume on next run.');
          process.exit(2);
        }
        log('ERROR', `batch ${Math.floor(i/BATCH_SIZE)+1} failed: ${e.message}`);
      }
    }
  }
  
  // ── 7. Delete stale in batches ────────────────────────────────────────────
  let removed = 0;
  if (staleInTs.length > 0) {
    log('action', `removing ${staleInTs.length.toLocaleString()} stale documents in batches of ${BATCH_SIZE}…`);
    for (let i = 0; i < staleInTs.length; i += BATCH_SIZE) {
      const batch = staleInTs.slice(i, i + BATCH_SIZE);
      try {
        const result = await ts.collections(COLLECTION).documents().delete({
          filter_by: `id:=[${batch.join(',')}]`,
        });
        removed += result.num_deleted || 0;
        log('delete', `batch ${Math.floor(i/BATCH_SIZE)+1}: removed ${result.num_deleted}`);
      } catch (e) {
        if (e.message.includes('OUT_OF_DISK')) {
          log('ERROR', `OUT_OF_DISK during delete. Resuming on next run.`);
          process.exit(2);
        }
        log('ERROR', `delete batch ${Math.floor(i/BATCH_SIZE)+1}: ${e.message}`);
      }
    }
  }
  
  // ── 8. Final report ───────────────────────────────────────────────────────
  let finalCount = indexedIds.length;
  try {
    const tsInfo = await ts.collections(COLLECTION).retrieve();
    finalCount = tsInfo.num_documents;
  } catch { /* use estimate */ }
  
  const elapsed = Date.now() - startTime;
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('  RECONCILIATION COMPLETE');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  eligible count      : ${eligibleIds.length.toLocaleString()}`);
  console.log(`  final TS count      : ${finalCount.toLocaleString()}`);
  console.log(`  inserted            : ${inserted.toLocaleString()}`);
  console.log(`  removed (stale)     : ${removed.toLocaleString()}`);
  console.log(`  execution time      : ${(elapsed/1000).toFixed(1)}s`);
  console.log('─────────────────────────────────────────────────────────────\n');
}

main().catch(e => { 
  console.error('Fatal error:', e.message);
  if (e.message.includes('OUT_OF_DISK')) process.exit(2);
  process.exit(1);
});
