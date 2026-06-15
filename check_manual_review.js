const { Client } = require('pg');
const URI = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const IDs = [123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,158,159,160,161,162,163,164,175,176,177,188,189,190,191,192,193,194,195,200,202,203,204,206,214,215,216,217,218,219,220,221];

async function queryBatch(ids) {
  const client = new Client({ connectionString: URI, statement_timeout: 8000 });
  try {
    await client.connect();
    const r = await client.query(
      `SELECT id, slug, status, derivatives_complete, thumb_url, small_url, medium_url FROM photos WHERE id = ANY($1) ORDER BY id`,
      [ids]
    );
    return r.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const byStatus = {};
  for (let i = 0; i < IDs.length; i += 20) {
    const batch = IDs.slice(i, i + 20);
    const rows = await queryBatch(batch);
    for (const row of rows) {
      const s = row.status;
      if (!byStatus[s]) byStatus[s] = { count: 0, hasThumb: 0, hasSmall: 0, hasMedium: 0, dcTrue: 0, dcFalse: 0 };
      byStatus[s].count++;
      if (row.thumb_url) byStatus[s].hasThumb++;
      if (row.small_url) byStatus[s].hasSmall++;
      if (row.medium_url) byStatus[s].hasMedium++;
      if (row.derivatives_complete) byStatus[s].dcTrue++; else byStatus[s].dcFalse++;
    }
  }
  console.log('65 manual-review records — status breakdown:');
  for (const [s, v] of Object.entries(byStatus)) {
    console.log(`  ${s}: count=${v.count} thumb=${v.hasThumb} small=${v.hasSmall} medium=${v.hasMedium} | dc_true=${v.dcTrue} dc_false=${v.dcFalse}`);
  }
  console.log(`\nTotal: ${IDs.length}`);

  // Archivable: status=archived|archived_unrecoverable with no valid derivatives
  let archivable = 0, recoverable = 0;
  for (const [s, v] of Object.entries(byStatus)) {
    if (s.includes('archived')) {
      if (v.hasThumb === 0) archivable += v.count;
      else recoverable += v.count;
    }
  }
  console.log(`\nArchivable (archived status, no thumb): ${archivable}`);
  console.log(`Recoverable (archived but thumb exists): ${recoverable}`);
}

main().catch(console.error);