#!/usr/bin/env node
/**
 * API Admin — List Customers
 * Usage: node scripts/api-list-customers.js
 * Shows: ID, email, name, company, plan, status, keys count, calls used
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
  console.log(`Usage: node scripts/api-list-customers.js
Lists all API customers with keys and usage summary.`);
  process.exit(0);
}

const now = new Date();
const period = parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);

async function listCustomers() {
  const rows = await sql`
    SELECT
      ac.id,
      ac.email,
      ac.name,
      ac.company,
      ap.name as plan,
      ap.slug as plan_slug,
      ac.status,
      ac.current_period_start,
      ac.current_period_end,
      COALESCE((
        SELECT amu.calls_used
        FROM api_monthly_usage amu
        WHERE amu.customer_id = ac.id AND amu.period_yyyymm = ${period}
      ), 0) as calls_used,
      ap.monthly_call_limit as call_limit,
      (
        SELECT COUNT(*)
        FROM api_keys ak
        WHERE ak.customer_id = ac.id
      ) as keys_count
    FROM api_customers ac
    JOIN api_plans ap ON ac.plan_id = ap.id
    ORDER BY ac.id ASC
  `;

  if (rows.length === 0) {
    console.log('No API customers found.');
    return;
  }

  console.log(`\n=== API Customers (${rows.length}) ===\n`);
  console.log('  ID   Email                          Name                  Company              Plan              Status    Keys  Calls    Limit');
  console.log('  ' + '─'.repeat(110));

  for (const r of rows) {
    const remaining = r.call_limit - r.calls_used;
    console.log(
      `  ${String(r.id).padStart(3)} ${String(r.email).padEnd(27)} ${String(r.name || '').padEnd(21)} ${String(r.company || '').padEnd(19)} ${String(r.plan).padEnd(15)} ${String(r.status).padEnd(9)} ${String(r.keys_count).padStart(4)} ${String(r.calls_used).padStart(6)} ${String(r.call_limit).padStart(6)}`
    );
  }

  console.log('');
  console.log(`Total: ${rows.length} customer(s)`);
  console.log('');

  // Per-customer key detail
  console.log('=== Key Details ===\n');
  for (const r of rows) {
    const keys = await sql`
      SELECT id, name, key_prefix, status, created_at
      FROM api_keys
      WHERE customer_id = ${r.id}
      ORDER BY created_at ASC
    `;
    console.log(`  ${r.email} (ID: ${r.id}):`);
    if (keys.length === 0) {
      console.log('    (no keys)');
    } else {
      for (const k of keys) {
        const created = new Date(k.created_at).toISOString().slice(0, 10);
        console.log(`    ${k.key_prefix}... — ${k.name} — ${k.status} — created ${created}`);
      }
    }
    console.log('');
  }
}

listCustomers().catch(e => {
  console.error(e.message);
  process.exit(1);
});