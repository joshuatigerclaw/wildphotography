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
  console.log('Typesense docs:', tsResult.found);

  const eligibleResult = await pool.query("SELECT id FROM photos WHERE search_ready = true AND status NOT IN ('archived', 'legacy_static')");
  const eligibleIds = new Set(eligibleResult.rows.map(r => String(r.id)));
  console.log('DB eligible:', eligibleIds.size);

  const exportRes = await client.collections('photos').documents().export();
  const existingIds = new Set();
  exportRes.split('\n').forEach(line => {
    try { existingIds.add(String(JSON.parse(line).id)); } catch(e) {}
  });
  console.log('Existing TS IDs:', existingIds.size);

  const missingIds = [...eligibleIds].filter(id => !existingIds.has(id));
  console.log('IDs to add:', missingIds.length);

  if (missingIds.length === 0) {
    console.log('Nothing to add');
    await pool.end();
    return;
  }

  let totalAdded = 0;
  let totalErrors = 0;
  const batchSize = 200;

  for (let i = 0; i < missingIds.length; i += batchSize) {
    const batchIds = missingIds.slice(i, i + batchSize).map(id => parseInt(id));

    const missingResult = await pool.query(`
      SELECT p.id, p.title, p.slug, p.description, p.thumb_url, p.location,
             p.large_url, p.medium_url, p.gallery_slug, p.keywords,
             p.date_taken, p.species_common_name, p.lat, p.lon, p.popularity
      FROM photos p
      WHERE p.id = ANY($1)
    `, [batchIds]);

    const docsToImport = missingResult.rows.map(r => {
      let dateTaken = 0;
      if (r.date_taken) {
        try { dateTaken = Math.floor(new Date(r.date_taken).getTime() / 1000); } catch(e) { dateTaken = 0; }
      }
      return {
        id: String(r.id),
        title: r.title || r.slug || '',
        slug: r.slug || '',
        description: (r.description || '').substring(0, 500),
        thumb_url: r.thumb_url || '',
        large_url: r.large_url || '',
        medium_url: r.medium_url || '',
        location: r.location || '',
        gallery_slug: r.gallery_slug || '',
        keywords: Array.isArray(r.keywords) ? r.keywords : (r.keywords ? r.keywords.split(',').map(k => k.trim()) : []),
        date_taken: dateTaken,
        lat: r.lat || 0,
        lon: r.lon || 0,
        species_common_name: r.species_common_name || '',
        popularity: r.popularity || 0
      };
    });

    try {
      const result = await client.collections('photos').documents().import(docsToImport, { batch: true });
      const success = result.reduce((sum, r) => sum + (r.success ? 1 : 0), 0);
      const errors = result.filter(r => !r.success).length;
      totalAdded += success;
      totalErrors += errors;
      if (errors > 0) {
        const firstError = result.filter(r => !r.success)[0];
        console.error(`Batch ${Math.floor(i/batchSize)}: +${success}, ${errors} errors. First:`, firstError?.error);
      } else {
        console.log(`Batch ${Math.floor(i/batchSize)}: +${success} indexed`);
      }
    } catch(e) {
      console.error('Batch exception:', e.message);
      totalErrors += docsToImport.length;
    }
  }

  const tsFinal = await client.collections('photos').documents().search({ q: '*', limit: 0 });
  console.log('\nFinal Typesense:', tsFinal.found, '| Added:', totalAdded, '| Errors:', totalErrors);
  
  await pool.end();
  console.log('Done');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });