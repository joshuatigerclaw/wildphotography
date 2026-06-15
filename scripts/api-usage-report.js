#!/usr/bin/env node
/**
 * API Admin — Usage Report
 * Usage: node scripts/api-usage-report.js [--customer-id N]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const argv = (() => {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      parsed[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    }
  }
  return parsed;
})();

if (argv.help) {
  console.log(`Usage: node scripts/api-usage-report.js [--customer-id N]
Shows usage for all customers or a specific one.
Example: node scripts/api-usage-report.js --customer-id 1`);
  process.exit(0);
}

const { 'customer-id': customerId } = argv;

const now = new Date();
const period = parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);

async function usageReport() {
  if (customerId) {
    const rows = await sql`
      SELECT
        ac.id, ac.email, ac.name, ac.company,
        ap.name as plan, ap.slug as plan_slug,
        ac.status,
        ac.current_period_start, ac.current_period_end,
        COALESCE((
          SELECT amu.calls_used
          FROM api_monthly_usage amu
          WHERE amu.customer_id = ac.id AND amu.period_yyyymm = ${period}
        ), 0) as calls_used,
        ap.monthly_call_limit as call_limit
      FROM api_customers ac
      JOIN api_plans ap ON ac.plan_id = ap.id
      WHERE ac.id = ${parseInt(customerId)}
      LIMIT 1
    `;

    if (rows.length === 0) {
      console.error(`No customer found with ID '${customerId}'`);
      process.exit(1);
    }

    const r = rows[0];
    const remaining = r.call_limit - r.calls_used;
    const periodEnd = new Date(r.current_period_end).toISOString().slice(0, 10);

    console.log(`\n=== Usage for ${r.email} (ID: ${r.id}) ===\n`);
    console.log(`  Plan:        ${r.plan} (${r.plan_slug})`);
    console.log(`  Status:      ${r.status}`);
    console.log(`  Calls Used:  ${r.calls_used}`);
    console.log(`  Limit:       ${r.call_limit}`);
    console.log(`  Remaining:  ${remaining}`);
    console.log(`  Period End: ${periodEnd}`);
    console.log('');

    // Key breakdown
    const keys = await sql`
      SELECT id, name, key_prefix, created_at,
        COALESCE((
          SELECT amu.calls_used
          FROM api_monthly_usage amu
          WHERE amu.customer_id = ${r.id} AND amu.period_yyyymm = ${period}
        ), 0) as calls_used
      FROM api_keys
      WHERE customer_id = ${r.id}
    `;

    console.log('  Keys:');
    if (keys.length === 0) {
      console.log('    (none)');
    } else {
      for (const k of keys) {
        console.log(`    ${k.key_prefix}... — ${k.name} (${k.calls_used} calls)`);
      }
    }
    console.log('');
  } else {
    // All customers
    const rows = await sql`
      SELECT
        ac.id, ac.email, ac.name, ac.company,
        ap.name as plan, ap.slug as plan_slug,
        ac.status,
        ac.current_period_end,
        COALESCE((
          SELECT amu.calls_used
          FROM api_monthly_usage amu
          WHERE amu.customer_id = ac.id AND amu.period_yyyymm = ${period}
        ), 0) as calls_used,
        ap.monthly_call_limit as call_limit
      FROM api_customers ac
      JOIN api_plans ap ON ac.plan_id = ap.id
      ORDER BY ac.id ASC
    `;

    console.log(`\n=== WildPhotography API Usage — ${period} ===\n`);
    console.log('  ID   Email                          Name                  Company              Plan              Status    Calls    Limit  Remaining  Period End');
    console.log('  ' + '─'.repeat(120));

    for (const r of rows) {
      const remaining = r.call_limit - r.calls_used;
      const periodEnd = new Date(r.current_period_end).toISOString().slice(0, 10);
      console.log(
        `  ${String(r.id).padStart(3)} ${String(r.email).padEnd(27)} ${String(r.name || '').padEnd(21)} ${String(r.company || '').padEnd(19)} ${String(r.plan).padEnd(15)} ${String(r.status).padEnd(9)} ${String(r.calls_used).padStart(6)} ${String(r.call_limit).padStart(6)} ${String(remaining).padStart(9)}  ${periodEnd}`
      );
    }
    console.log('');
    console.log(`Total customers: ${rows.length}`);
    console.log('');
  }
}

usageReport().catch(e => {
  console.error(e.message);
  process.exit(1);
});