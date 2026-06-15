const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NEON_CONNECTION_STRING);

async function main() {
  // Count by reason for not search_ready
  const noKey = await sql`SELECT COUNT(*) as cnt FROM photos WHERE (search_ready = false OR search_ready IS NULL) AND (original_r2_key IS NULL OR original_r2_key = '')`;
  const hasKeyNotReady = await sql`SELECT COUNT(*) as cnt FROM photos WHERE (search_ready = false OR search_ready IS NULL) AND original_r2_key IS NOT NULL AND original_r2_key != ''`;

  console.log('=== Not Search Ready Breakdown ===');
  console.log('Missing R2 key (null/empty):', noKey[0].cnt);
  console.log('Has R2 key but not ready:', hasKeyNotReady[0].cnt);
  console.log('');
  
  // Confirm all 62K have metadata_complete=true
  const metaResult = await sql`SELECT COUNT(*) as total, SUM(CASE WHEN metadata_complete THEN 1 ELSE 0 END) as complete FROM photos`;
  console.log('=== Metadata Complete ===');
  console.log('Total:', metaResult[0].total, '| Complete:', metaResult[0].complete);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});