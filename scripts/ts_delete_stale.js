const { Client } = require('typesense');
const { Pool } = require('pg');
const https = require('https');

const TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const client = new Client({
  nodes: [{ host: TS_HOST, port: 443, protocol: 'https' }],
  apiKey: TS_KEY,
  httpAgent: new https.Agent({ keepAlive: true }),
  timeoutMs: 90000
});

async function run() {
  const pool = new Pool({ connectionString: NEON_CONN });
  
  // Get all eligible DB IDs
  const dbRes = await pool.query("SELECT id FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')");
  const dbIds = new Set(dbRes.rows.map(r => r.id));
  console.log('DB eligible IDs:', dbIds.size);
  
  // Export TS docs and find stale ones
  console.log('Exporting TS docs...');
  const exportRes = await client.collections('photos').documents().export();
  const lines = exportRes.split('\n').filter(l => l.trim());
  console.log('TS exported lines:', lines.length);
  
  const stale = [];
  for (const line of lines) {
    try {
      const doc = JSON.parse(line);
      if (!dbIds.has(doc.id)) {
        stale.push(doc.id);
      }
    } catch(e) {}
  }
  console.log('Stale (TS only):', stale.length);
  
  if (stale.length === 0) {
    console.log('No stale entries - reconcile complete');
    await pool.end();
    return;
  }
  
  // Delete stale entries in batches of 50
  let deleted = 0;
  let errors = 0;
  for (let i = 0; i < stale.length; i += 50) {
    const batch = stale.slice(i, i + 50);
    try {
      // Delete each individually (batch delete API is limited)
      for (const id of batch) {
        try {
          await client.collections('photos').documents(String(id)).delete();
          deleted++;
        } catch(e) {
          // 404 means already gone, which is fine
          if (!e.message.includes('404')) {
            errors++;
          } else {
            deleted++;
          }
        }
      }
      console.log('Deleted ' + deleted + '/' + stale.length);
    } catch(e) {
      errors++;
      console.error('Batch delete error:', e.message);
    }
  }
  console.log('Done. Deleted:', deleted, 'Errors:', errors);
  await pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
