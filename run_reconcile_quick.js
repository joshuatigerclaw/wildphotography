const { Client } = require('typesense');
const https = require('https');

const TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const client = new Client({
  nodes: [{ host: TS_HOST, port: 443, protocol: 'https' }],
  apiKey: TS_KEY
});

async function run() {
  // Get Typesense count
  const tsResult = await client.collections('photos').documents().search({ q: '*', limit: 0 });
  const tsCount = tsResult.found;
  console.log('Typesense docs:', tsCount);

  // Get DB eligible count via raw query
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: NEON_CONN });
  const dbResult = await pool.query("SELECT COUNT(*) FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')");
  const dbEligible = parseInt(dbResult.rows[0].count);
  console.log('DB eligible:', dbEligible);

  const drift = tsCount - dbEligible;
  console.log('Drift:', drift);

  if (Math.abs(drift) > 10) {
    console.log('Running reconciliation...');
    // Get eligible IDs
    const eligibleResult = await pool.query("SELECT id FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')");
    const eligibleIds = new Set(eligibleResult.rows.map(r => String(r.id)));
    console.log('Eligible IDs count:', eligibleIds.size);

    // Export Typesense docs
    const exportRes = await client.collections('photos').documents().export();
    const lines = exportRes.split('\n').filter(l => l.trim());
    console.log('Typesense exported lines:', lines.length);

    let toDelete = 0;
    let deleted = 0;
    for (const line of lines) {
      try {
        const doc = JSON.parse(line);
        const pid = String(doc.id);
        if (pid && !eligibleIds.has(pid)) {
          toDelete++;
          await client.collections('photos').documents(pid).delete();
          deleted++;
        }
      } catch(e) {}
    }
    console.log(`Stale: ${toDelete}, Removed: ${deleted}`);
  } else {
    console.log('Drift within tolerance, no reconcile needed');
  }

  await pool.end();
  console.log('Done');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });