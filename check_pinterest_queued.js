const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require', max: 1 });

async function main() {
  const r = await p.query("SELECT pin_image_path FROM pinterest_pins WHERE status = 'queued' LIMIT 5");
  console.log('Queued pins with image paths:');
  console.log(JSON.stringify(r.rows, null, 2));
  
  const r2 = await p.query("SELECT COUNT(*) as cnt FROM pinterest_pins WHERE status = 'queued' AND pin_image_path IS NULL");
  console.log('\nQueued without image path:', JSON.stringify(r2.rows));
  
  const r3 = await p.query("SELECT board, COUNT(*) as cnt FROM pinterest_pins WHERE status = 'queued' GROUP BY board ORDER BY cnt DESC LIMIT 10");
  console.log('\nBy board:');
  console.log(JSON.stringify(r3.rows, null, 2));
  
  p.end();
}

main().catch(e => console.log(e.message));