#!/usr/bin/env node
/**
 * scripts/typesense-reconcile-batch.js
 * Batch typesense reconciliation with proper error handling.
 * 
 * Run: node scripts/typesense-reconcile-batch.js --batch-size 500
 * 
 * Fixes the "No documents provided" error in the main reconcile script
 * by processing in properly bounded batches.
 */

'use strict';

const { neon } = require('@neondatabase/serverless');
const Typesense = require('typesense');

const NEON_DB = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
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

function transformPhoto(r) {
  const lat = typeof r.lat === 'number' ? r.lat : parseFloat(String(r.lat) || '0');
  const lon = typeof r.lon === 'number' ? r.lon : parseFloat(String(r.lon) || '0');
  // Parse keywords as array (comma-separated string → array)
  const kwRaw = typeof r.keywords === 'string' ? r.keywords.trim() : '';
  const keywords = kwRaw ? kwRaw.split(',').map(k => k.trim()).filter(k => k) : [];
  const doc = {
    id:           String(r.id),
    slug:         r.slug            || '',
    title:        r.title           || ('Photo ' + r.id),
    description:  r.description     || '',
    keywords:     keywords,
    category:     r.category        || '',
    country:      r.country          || '',
    region:       r.region          || '',
    location:     r.location_name   || '',
    thumb_url:    r.thumb_url       || '',
    small_url:    r.small_url       || '',
    medium_url:   r.medium_url      || '',
    large_url:    r.large_url       || '',
    og_image_url: r.og_image_url   || '',
    gallery_id:   Number(r.gallery_id) || 0,
    gallery_slug: r.gallery_slug   || '',
    popularity:   typeof r.popularity === 'number' && !isNaN(r.popularity) ? r.popularity : 0,
    derivatives_complete: Boolean(r.derivatives_complete),
    species:      r.species          || '',
    url:          'https://www.wildphotography.com/photo/' + (r.slug || ''),
  };
  if (!isNaN(lat) && lat !== 0) doc.lat = lat;
  if (!isNaN(lon) && lon !== 0) doc.lon = lon;
  if (r.date_taken) {
    const d = new Date(r.date_taken);
    if (!isNaN(d.getTime())) doc.date_taken = Math.floor(d.getTime() / 1000);
  }
  return doc;
}

async function main() {
  const startTime = Date.now();
  
  log('start', `Typesense batch reconcile (batch size: ${BATCH_SIZE})`);
  
  // Get eligible IDs
  log('query', 'fetching eligible photo IDs from Neon…');
  const eligibleRows = await sql`
    SELECT id FROM photos 
    WHERE ready_for_public_render = true 
      AND derivatives_complete = true 
      AND is_active = true
    ORDER BY id
  `;
  const eligibleIds = eligibleRows.map(r => Number(r.id));
  const eligibleSet = new Set(eligibleIds);
  log('eligible', `${eligibleIds.length} photos eligible in Neon`);
  
  // Get indexed IDs from Typesense
  log('query', 'fetching indexed document IDs from Typesense…');
  const ndjson = await ts.collections(COLLECTION).documents().export({ include_fields: 'id' });
  const indexedIds = [];
  for (const line of ndjson.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.id !== undefined) indexedIds.push(String(parsed.id));
    } catch { /* skip */ }
  }
  const indexedSet = new Set(indexedIds);
  log('indexed', `${indexedIds.length} documents currently in Typesense`);
  
  // Compute diff
  const missingInTs = eligibleIds.filter(id => !indexedSet.has(String(id)));
  // Bugfix: indexedIds contains strings (from TS export) but eligibleSet contains Numbers.
  // Without Number() coercion, every string id fails the Set.has() lookup → all docs flagged stale.
  const staleInTs   = indexedIds.filter(id => !eligibleSet.has(Number(id)));
  log('diff', `missing from TS: ${missingInTs.length} | stale in TS: ${staleInTs.length}`);
  
  // Insert missing in batches
  let inserted = 0;
  if (missingInTs.length > 0) {
    log('action', `inserting ${missingInTs.length} missing documents in batches of ${BATCH_SIZE}…`);
    for (let i = 0; i < missingInTs.length; i += BATCH_SIZE) {
      const batchIds = missingInTs.slice(i, i + BATCH_SIZE).map(id => Number(id));
      const rows = await sql`
        SELECT id, slug, title, description, keywords, category, country, region,
               location_name, thumb_url, small_url, medium_url, large_url, og_image_url,
               lat, lon, date_taken, popularity, gallery_id, gallery_slug, derivatives_complete,
               COALESCE(species_common_name, '') as species
        FROM photos WHERE id = ANY(${batchIds})
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
        log('ERROR', `batch ${Math.floor(i/BATCH_SIZE)+1} failed: ${e.message}`);
      }
    }
  }
  
  // Delete stale in batches
  let removed = 0;
  if (staleInTs.length > 0) {
    log('action', `removing ${staleInTs.length} stale documents in batches of ${BATCH_SIZE}…`);
    for (let i = 0; i < staleInTs.length; i += BATCH_SIZE) {
      const batch = staleInTs.slice(i, i + BATCH_SIZE);
      try {
        const result = await ts.collections(COLLECTION).documents().delete({
          filter_by: `id:=[${batch.join(',')}]`,
        });
        removed += result.num_deleted || 0;
        log('delete', `batch ${Math.floor(i/BATCH_SIZE)+1}: removed ${result.num_deleted}`);
      } catch (e) {
        log('ERROR', `delete batch ${Math.floor(i/BATCH_SIZE)+1}: ${e.message}`);
      }
    }
  }
  
  const elapsed = Date.now() - startTime;
  const tsInfo = await ts.collections(COLLECTION).retrieve();
  
  console.log('\n─────────────────────────────────────────────');
  console.log('  RECONCILIATION COMPLETE');
  console.log('─────────────────────────────────────────────');
  console.log(`  eligible count      : ${eligibleIds.length.toLocaleString()}`);
  console.log(`  final TS count      : ${tsInfo.num_documents.toLocaleString()}`);
  console.log(`  inserted            : ${inserted.toLocaleString()}`);
  console.log(`  removed (stale)     : ${removed.toLocaleString()}`);
  console.log(`  execution time      : ${(elapsed/1000).toFixed(1)}s`);
  console.log('─────────────────────────────────────────────\n');
}

main().catch(e => { console.error('Fatal error:', e.message); process.exit(1); });