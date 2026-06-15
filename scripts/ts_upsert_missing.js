const { Client } = require('typesense');
const { Pool } = require('pg');
const https = require('https');

const TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const client = new Client({
  nodes: [{ host: TS_HOST, port: 443, protocol: 'https' }],
  apiKey: TS_KEY,
  httpAgent: new https.Agent({ keepAlive: true, timeout: 120000 }),
  timeoutMs: 90000
});

async function getTSCount() {
  const res = await client.collections('photos').documents().search({ q: '*', limit: 0 });
  return res.found;
}

async function run() {
  const pool = new Pool({ connectionString: NEON_CONN });
  
  console.log('Getting TS count...');
  const tsCount = await getTSCount();
  console.log('TS count:', tsCount);
  
  // Get DB eligible count
  const dbCountRes = await pool.query("SELECT COUNT(*) FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')");
  const dbCount = parseInt(dbCountRes.rows[0].count);
  console.log('DB eligible:', dbCount);
  
  const missingCount = dbCount - tsCount;
  console.log('Missing (DB - TS):', missingCount);
  
  if (missingCount <= 0) {
    console.log('No missing records');
    await pool.end();
    return;
  }
  
  // Get missing IDs directly from DB using offset approach
  // We can't use NOT IN with thousands of values, so use a different approach:
  // Use a temp table or chunked approach
  // Actually, let's just get all DB IDs (they're just integers) and compare
  console.log('Fetching all DB IDs...');
  const dbIdsRes = await pool.query("SELECT id FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static') ORDER BY id");
  const dbIds = dbIdsRes.rows.map(r => r.id);
  console.log('DB IDs fetched:', dbIds.length);
  
  // Now get TS IDs via export (with longer timeout)
  console.log('Exporting TS IDs...');
  let tsIds;
  try {
    const exportRes = await client.collections('photos').documents().export();
    tsIds = new Set();
    for (const line of exportRes.split('\n')) {
      if (line.trim()) {
        try { tsIds.add(JSON.parse(line).id); } catch(e) {}
      }
    }
    console.log('TS IDs from export:', tsIds.size);
  } catch(e) {
    console.error('TS export failed:', e.message, '- using estimate approach');
    tsIds = null;
  }
  
  let missingIds;
  if (tsIds) {
    missingIds = dbIds.filter(id => !tsIds.has(id));
  } else {
    // Fallback: estimate missing as dbCount - tsCount and take first N DB IDs not in TS
    // This is approximate - better than nothing
    console.log('Cannot compute exact missing - exiting');
    await pool.end();
    return;
  }
  
  console.log('Exact missing IDs:', missingIds.length);
  
  if (missingIds.length === 0) {
    console.log('No missing - reconcile complete');
    await pool.end();
    return;
  }
  
  // Fetch full records for missing IDs in batches
  let allRecords = [];
  for (let i = 0; i < missingIds.length; i += 500) {
    const batch = missingIds.slice(i, i + 500);
    const placeholders = batch.map((_, idx) => '$' + (idx + 1)).join(',');
    const recRes = await pool.query(`
      SELECT p.id, p.slug, p.title, p.thumb_url, COALESCE(p.description, '') as description,
             COALESCE(p.keywords, '') as keywords, COALESCE(p.location_name, '') as location_name,
             COALESCE(p.country, '') as country, COALESCE(p.region, '') as region,
             COALESCE(p.gallery_slug, '') as gallery_slug,
             COALESCE(p.species_common_name, '') as species_common_name,
             COALESCE(p.animal_group, '') as animal_group
      FROM photos p WHERE p.id IN (` + placeholders + `)`, batch);
    allRecords = allRecords.concat(recRes.rows);
    console.log('Fetched ' + allRecords.length + '/' + missingIds.length);
  }
  
  console.log('Upserting', allRecords.length, 'records in batches of 50...');
  let upserted = 0;
  let errors = 0;
  for (let i = 0; i < allRecords.length; i += 50) {
    const batch = allRecords.slice(i, i + 50);
    try {
      await client.collections('photos').documents().upsert(batch);
      upserted += batch.length;
      if (upserted % 500 === 0) console.log('Upserted ' + upserted + '/' + allRecords.length);
    } catch(e) {
      errors++;
      if (errors <= 5) console.error('Error at ' + i + ':', e.message);
    }
  }
  console.log('Done. Upserted:', upserted, 'Errors:', errors);
  await pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
