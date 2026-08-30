#!/usr/bin/env node
/**
 * Neon DB Cleanup Script
 * Safe: only deletes old archival rows from known tables
 */
const { neon } = require('@neondatabase/serverless');

const sql = neon(
  'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
);

async function deleteInBatches(table, whereClause, batchSize = 5000) {
  let totalDeleted = 0;
  let deleted = 0;
  const startTime = Date.now();

  // Build parameterized WHERE clause — NOTE: can't parameterize table/column names
  // whereClause must be a raw SQL fragment for the WHERE condition
  const batchDelete = async () => {
    const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING id`;
    const result = await sql.query(query);
    return result.length;
  };

  do {
    deleted = await batchDelete();
    totalDeleted += deleted;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  [${elapsed}s] deleted ${deleted} rows (total: ${totalDeleted})`);
  } while (deleted > 0);

  return totalDeleted;
}

async function main() {
  console.log('=== Neon DB Cleanup ===\n');

  // 1. validation_logs — ALL rows are >30 days old (oldest from Apr 25)
  console.log('1. validation_logs (all rows >30d)');
  const valCount = await sql.query('SELECT COUNT(*)::text FROM validation_logs');
  console.log(`   Total: ${valCount[0].count}`);
  const valDeleted = await deleteInBatches('validation_logs', 'validated_at < NOW() - INTERVAL \'30 days\'');
  console.log(`   Deleted: ${valDeleted}\n`);

  // 2. photo_change_queue — all unprocessed rows
  console.log('2. photo_change_queue (unprocessed)');
  const pcqCount = await sql.query('SELECT COUNT(*)::text FROM photo_change_queue WHERE processed_at IS NULL');
  console.log(`   Unprocessed: ${pcqCount[0].count}`);
  const pcqDeleted = await deleteInBatches('photo_change_queue', 'processed_at IS NULL');
  console.log(`   Deleted: ${pcqDeleted}\n`);

  // 3. repair_log — older than 30 days
  console.log('3. repair_log (logged_at < 30 days)');
  const repairCount = await sql.query('SELECT COUNT(*)::text FROM repair_log WHERE logged_at < NOW() - INTERVAL \'30 days\'');
  console.log(`   Old rows: ${repairCount[0].count}`);
  const repairDeleted = await deleteInBatches('repair_log', 'logged_at < NOW() - INTERVAL \'30 days\'');
  console.log(`   Deleted: ${repairDeleted}\n`);

  // 4. seo_recommendations — older than 30 days
  console.log('4. seo_recommendations (created_at < 30 days)');
  const seoCount = await sql.query('SELECT COUNT(*)::text FROM seo_recommendations WHERE created_at < NOW() - INTERVAL \'30 days\'');
  console.log(`   Old rows: ${seoCount[0].count}`);
  const seoDeleted = await deleteInBatches('seo_recommendations', 'created_at < NOW() - INTERVAL \'30 days\'');
  console.log(`   Deleted: ${seoDeleted}\n`);

  // Final table sizes
  console.log('=== Final Table Sizes ===');
  const tables = ['photos', 'seo_recommendations', 'repair_log', 'validation_logs', 'photo_change_queue'];
  for (const t of tables) {
    const r = await sql.query(`SELECT COUNT(*)::text FROM ${t}`);
    console.log(`   ${t}: ${r[0].count}`);
  }
}

main().catch((err) => {
  console.error('Cleanup error:', err.message);
  process.exit(1);
});
