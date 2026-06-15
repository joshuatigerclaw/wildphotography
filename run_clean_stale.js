const { Client } = require('typesense');

const TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const client = new Client({
  nodes: [{ host: TS_HOST, port: 443, protocol: 'https' }],
  apiKey: TS_KEY,
  connectionTimeoutSeconds: 15,
  maxRetries: 2
});

async function run() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: NEON_CONN, statement_timeout: 20000 });
  
  const tsResult = await client.collections('photos').documents().search({ q: '*', limit: 0 });
  const tsCount = tsResult.found;
  console.log('Typesense docs:', tsCount);

  const eligibleResult = await pool.query("SELECT id FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')");
  const eligibleIds = new Set(eligibleResult.rows.map(r => String(r.id)));
  console.log('DB eligible:', eligibleIds.size);

  const exportRes = await client.collections('photos').documents().export();
  const tsIds = [];
  exportRes.split('\n').forEach(line => {
    try { tsIds.push(String(JSON.parse(line).id)); } catch(e) {}
  });
  console.log('TS total exported:', tsIds.length);

  // Find stale: in TS but not in eligible
  const staleIds = tsIds.filter(id => !eligibleIds.has(id));
  console.log('Stale IDs to remove:', staleIds.length);

  if (staleIds.length > 0) {
    // Delete in batches
    let deleted = 0;
    for (let i = 0; i < staleIds.length; i += 100) {
      const batch = staleIds.slice(i, i + 100);
      try {
        await client.collections('photos').documents(batch).delete();
        deleted += batch.length;
        console.log(`Deleted batch ${Math.floor(i/100)}: ${batch.length} stale docs`);
      } catch(e) {
        console.error(`Delete batch error:`, e.message);
      }
    }
    console.log('Total stale removed:', deleted);
  } else {
    console.log('No stale docs to remove');
  }

  const tsFinal = await client.collections('photos').documents().search({ q: '*', limit: 0 });
  console.log('Final Typesense count:', tsFinal.found);
  
  await pool.end();
  console.log('Done');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });