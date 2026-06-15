const { Client } = require('pg');
const URI = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const REMAINING_MANUAL_REVIEW_IDS = [123,126,127,161,162,163,164,188,189,190,191,192,193,194,195,200,202,203,204,206,214,215,216,217,218,219,220,221];

async function queryBatch(ids) {
  const client = new Client({ connectionString: URI, statement_timeout: 8000 });
  try {
    await client.connect();
    const placeholders = ids.map((_, i) => `$${i+1}`).join(',');
    const r = await client.query(
      `SELECT id, slug, status, derivatives_complete, thumb_url, small_url, medium_url, original_r2_key FROM photos WHERE id IN (${placeholders}) ORDER BY id`,
      ids
    );
    return r.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const rows = [];
  for (let i = 0; i < REMAINING_MANUAL_REVIEW_IDS.length; i += 20) {
    const batch = REMAINING_MANUAL_REVIEW_IDS.slice(i, i + 20);
    const batchRows = await queryBatch(batch);
    rows.push(...batchRows);
  }

  let canArchive = []; // archived_unrecoverable + no derivs
  let mightRecover = []; // archived_unrecoverable + has original R2 key
  let needsManualCheck = []; // everything else

  for (const row of rows) {
    const hasDeriv = !!(row.thumb_url);
    const hasOrig = !!(row.original_r2_key);

    if (row.status === 'archived_unrecoverable') {
      if (hasOrig) mightRecover.push(row);
      else canArchive.push(row);
    } else {
      needsManualCheck.push({ ...row, reason: `status=${row.status}, thumb=${hasDeriv}, orig=${hasOrig}` });
    }
  }

  console.log('=== 28 Remaining Manual Review Items ===\n');
  console.log(`CAN ARCHIVE (archived_unrecoverable, no R2 original, no derivatives): ${canArchive.length}`);
  for (const r of canArchive) console.log(`  ID ${r.id}: status=${r.status} slug=${r.slug.slice(0,50)}`);
  console.log(`\nMIGHT RECOVER (archived_unrecoverable but has R2 original): ${mightRecover.length}`);
  for (const r of mightRecover) console.log(`  ID ${r.id}: status=${r.status} slug=${r.slug.slice(0,50)} orig=${r.original_r2_key ? 'YES' : 'NO'}`);
  console.log(`\nNEEDS MANUAL CHECK (not archived_unrecoverable): ${needsManualCheck.length}`);
  for (const r of needsManualCheck) console.log(`  ID ${r.id}: status=${r.status} thumb=${!!r.thumb_url} orig=${!!r.original_r2_key} reason=${r.reason}`);
}

main().catch(console.error);