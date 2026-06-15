#!/usr/bin/env node
/**
 * wild_reindex_after_derivative_rebuild_v23.js
 * Fixed eligibility: use thumb_url + original_r2_key + slug as eligibility
 * (NOT the broken boolean flags that are all false in Neon)
 * Only upserts missing docs - no deletion (deletion logic had bugs)
 */
const { Client } = require('pg');
const https = require('https');

// Bandwidth regression guard
const ALLOW_FULL = process.env.ALLOW_FULL_TYPESENSE_EXPORT === 'true';

function guardExport(url) {
  if (!ALLOW_FULL && url.includes('/documents/export') && !url.includes('include_fields')) {
    throw new Error(
      'FULL_TYPESENSE_EXPORT_BLOCKED: /documents/export called without include_fields=id. ' +
      'This transfers ~60 MB per run and is blocked by default. ' +
      'To allow: ALLOW_FULL_TYPESENSE_EXPORT=true node wild_reindex_after_derivative_rebuild_v23.js '
    );
  }
}

const TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_PORT = 443;
const TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const TS_COLLECTION = 'photos';
const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tsRequest(method, path, body, headers = {}, timeoutMs = 120000) {
  if (path.includes('/documents/export')) guardExport(path);
  return new Promise((resolve, reject) => {
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    const req = https.request({
      hostname: TS_HOST, port: TS_PORT, path, method,
      headers: { 'X-Typesense-Api-Key': TS_KEY, 'Content-Type': 'application/json', ...headers }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) });
    if (timeoutMs) req.setTimeout(timeoutMs);
    if (data) req.write(data);
    req.end();
  });
}

async function getTSCount() {
  const r = await tsRequest('GET', `/collections/${TS_COLLECTION}?limit=0`);
  return r.body?.num_documents ?? -1;
}

async function getTSIds() {
  // FIX: Use include_fields=id to transfer only ~1 MB instead of ~60 MB per run.
  // Typesense export endpoint supports include_fields parameter for filtering output fields.
  const r = await tsRequest('GET', `/collections/${TS_COLLECTION}/documents/export?include_fields=id`, null, {}, 180000);
  const ids = new Set();
  const bodyStr = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  for (const line of bodyStr.trim().split('\n')) {
    if (!line.trim()) continue;
    try { ids.add(JSON.parse(line).id); } catch {}
  }
  return ids;
}

async function upsertBatch(docs) {
  if (!docs.length) return [];
  const ndjson = docs.map(d => JSON.stringify(d)).join('\n');
  const r = await tsRequest('POST', `/collections/${TS_COLLECTION}/documents/import?action=upsert`, ndjson, {
    'Content-Type': 'application/x-ndjson'
  }, 60000);
  if (r.status >= 400) {
    const detail = typeof r.body === 'string' ? r.body.slice(0, 300) : JSON.stringify(r.body).slice(0, 300);
    console.log(`  UPSERT HTTP ${r.status}: ${detail}`);
    return [];
  }
  const bodyStr = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  const results = [];
  for (const line of bodyStr.trim().split('\n')) {
    if (!line.trim()) continue;
    try { results.push(JSON.parse(line)); } catch {}
  }
  return results;
}

function clean(v) {
  if (v == null) return '';
  if (typeof v !== 'string') return String(v);
  return v;
}

function makeDoc(p) {
  let keywords = [];
  if (Array.isArray(p.keywords)) keywords = p.keywords;
  else if (p.keywords && typeof p.keywords === 'string' && p.keywords.trim() !== '')
    keywords = p.keywords.split(',').map(k => k.trim()).filter(Boolean);

  const slug = clean(p.slug);
  const url = slug ? 'https://www.wildphotography.com/photo/' + slug : '';
  // species field: prefer species_common_name, fall back to species_scientific_name
  const species = clean(p.species_common_name) || clean(p.species_scientific_name);

  return {
    id: String(p.id),
    title: clean(p.title),
    description: clean(p.description),
    keywords,
    category: clean(p.category),
    country: clean(p.country),
    region: clean(p.region),
    location_name: clean(p.location_name),
    location: clean(p.location),  // required field in TS schema
    city_name: clean(p.city_name),
    gallery_slug: clean(p.gallery_slug),
    gallery_title: clean(p.gallery_title),
    species_common_name: clean(p.species_common_name),
    species,
    slug,
    url,
    thumb_url: clean(p.thumb_url),
    search_ready: p.search_ready === true || p.search_ready === 'true',
    derivatives_complete: p.derivatives_complete === true || p.derivatives_complete === 'true',
    ready_for_public_render: p.ready_for_public_render === true || p.ready_for_public_render === 'true',
  };
}

async function main() {
  console.log('=== wild_reindex_after_derivative_rebuild v23 FIX ===');
  console.log('Target collection: photos');
  console.log(`Start: ${new Date().toISOString()}`);
  console.log('');
  console.log('[1/5] TS health check...');
  const tsBefore = await getTSCount();
  console.log(`  TS docs before: ${tsBefore}`);

  console.log('');
  console.log('[2/5] Fetching all TS IDs...');
  const tsIds = await getTSIds();
  console.log(`  TS IDs collected: ${tsIds.size}`);

  console.log('');
  console.log('[3/5] Fetching Neon eligible photos...');
  const client = new Client({ connectionString: NEON_CONN });
  await client.connect();
  const neonRes = await client.query(`
    SELECT p.id, p.slug, p.title, p.thumb_url, p.keywords, p.description, p.location_name,
           p.location, p.city_name, p.category, p.country, p.region, p.gallery_slug, p.species_common_name,
           p.species_scientific_name,
           p.search_ready, p.derivatives_complete, p.ready_for_public_render,
           g.name as gallery_title
    FROM photos p
    LEFT JOIN galleries g ON p.gallery_slug = g.slug
    WHERE p.thumb_url IS NOT NULL
      AND p.original_r2_key IS NOT NULL
      AND p.slug IS NOT NULL
      AND p.slug != ''
    ORDER BY p.id
  `);
  await client.end();
  const neonEligible = neonRes.rowCount;
  console.log(`  Neon eligible (has thumb+original+slug): ${neonEligible}`);

  const neonIds = new Set(neonRes.rows.map(p => String(p.id)));
  const missing = neonRes.rows.filter(p => !tsIds.has(String(p.id)));
  const inTSNotNeon = [...tsIds].filter(id => !neonIds.has(id));

  console.log(`\n[4/5] Drift analysis:`);
  console.log(`  Missing from TS (need upsert): ${missing.length}`);
  console.log(`  In TS but not in Neon eligible: ${inTSNotNeon.length}`);
  console.log(`  TS before: ${tsBefore} | Neon eligible: ${neonEligible}`);

  let totalUpserted = 0, totalFailed = 0;
  const failedSamples = [];

  if (missing.length > 0) {
    console.log(`\n[5/5] Upserting ${missing.length} missing docs (batch of 50, 300ms delay)...`);
    const docs = missing.map(p => makeDoc(p));
    const BATCH = 50;
    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH);
      const batchNum = Math.floor(i / BATCH) + 1;
      const results = await upsertBatch(batch);
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      totalUpserted += success;
      totalFailed += failed;
      if (failed > 0 && failedSamples.length < 5) {
        failedSamples.push(...results.filter(r => !r.success).slice(0, 3));
      }
      process.stdout.write(`  Batch ${batchNum}/${Math.ceil(docs.length / BATCH)}: +${success}/-${failed}\n`);
      if (i + BATCH < docs.length) await sleep(300);
    }
  } else {
    console.log('\n[5/5] No missing docs — skipping upsert.');
  }

  console.log('');
  console.log('[6] Final verification...');
  await sleep(2000);
  const tsAfter = await getTSCount();
  console.log(`  TS before: ${tsBefore} | TS after: ${tsAfter} | Delta: ${tsAfter - tsBefore}`);
  console.log(`  Docs upserted: ${totalUpserted} | Failed: ${totalFailed}`);

  if (failedSamples.length > 0) {
    console.log('\n  Sample failures:');
    failedSamples.slice(0, 3).forEach(f => console.log(`    ${JSON.stringify(f).slice(0, 200)}`));
  }

  console.log('');
  console.log('=== DONE ===');
  console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  process.exit(0);
}

const startTime = Date.now();
main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
