const { Client } = require('pg');
const client = new Client('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
async function main() {
  await client.connect();
  
  const [total, derivDone, searchReady, drq, pinQ, orphan, seo] = await Promise.all([
    client.query('SELECT COUNT(*) FROM photos'),
    client.query('SELECT COUNT(*) FROM photos WHERE derivatives_complete = true'),
    client.query('SELECT COUNT(*) FROM photos WHERE search_ready = true'),
    client.query('SELECT status, COUNT(*) FROM derivative_rebuild_queue GROUP BY status'),
    client.query("SELECT COUNT(*) FILTER (WHERE status='pending') as p, COUNT(*) FILTER (WHERE status='published') as pub, COUNT(*) FILTER (WHERE status='failed') as fail FROM pin_queue"),
    client.query('SELECT COUNT(*) FROM orphan_page_review_queue'),
    client.query("SELECT COUNT(*) FROM seo_build_queue WHERE status = 'pending'")
  ]);
  
  console.log('=== PHOTOS ===');
  console.log('Total:', total.rows[0].count, '| Derivatives done:', derivDone.rows[0].count, '| Search ready:', searchReady.rows[0].count);
  
  console.log('\n=== QUEUES ===');
  console.log('DRQ:');
  drq.rows.forEach(r => console.log(' ', r.status, ':', r.count));
  console.log('Pin queue - pending:', pinQ.rows[0].p, '| published:', pinQ.rows[0].pub, '| failed:', pinQ.rows[0].fail);
  console.log('Orphan review:', orphan.rows[0].count);
  console.log('SEO build pending:', seo.rows[0].count);
  
  const ts = await client.query('SELECT created_at::text, action, documents_affected, error FROM typesense_sync_log ORDER BY created_at DESC LIMIT 3');
  console.log('\n=== RECENT TS SYNC ===');
  ts.rows.forEach(r => console.log(' ', r.created_at, r.action, r.documents_affected, r.error ? 'ERR:'+r.error.substring(0,50) : ''));
  
  await client.end();
}
main().catch(e => console.error('Error:', e.message));