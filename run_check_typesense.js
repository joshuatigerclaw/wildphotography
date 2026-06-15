const { Client } = require('typesense');

const TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const client = new Client({
  nodes: [{ host: TS_HOST, port: 443, protocol: 'https' }],
  apiKey: TS_KEY,
  connectionTimeoutSeconds: 10,
  maxRetries: 1
});

async function run() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: NEON_CONN, statement_timeout: 15000 });
  
  // Get Typesense schema
  try {
    const schema = await client.collections('photos').retrieve();
    console.log('Schema fields:', JSON.stringify(schema.fields?.slice(0,20), null, 2));
  } catch(e) {
    console.error('Schema error:', e.message);
  }

  // Try a single document import with detailed error
  const testDoc = {
    id: 999999999,
    title: 'test',
    slug: 'test-slug',
    description: 'test',
    thumb_url: 'https://wildphoto-storage.s3.amazonaws.com/test_thumb.jpg',
    location: '',
    camera_model: '',
    date_taken: '',
    keywords: '',
    gallery_slug: '',
    seo_title: '',
    meta_description: '',
    og_image_url: '',
    status: 'draft',
    width: 0,
    height: 0,
    lat: 0,
    lon: 0,
    subjects: []
  };

  try {
    const result = await client.collections('photos').documents().import([testDoc]);
    console.log('Import result:', JSON.stringify(result));
  } catch(e) {
    console.error('Import error:', JSON.stringify(e.importResults || e.message));
  }

  await pool.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });