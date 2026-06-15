#!/usr/bin/env node
/**
 * API Admin — Create Customer
 * Usage: node scripts/api-create-customer.js --email test@example.com --name "Test" --company "Acme" --plan explorer
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
  console.log(`Usage: node scripts/api-create-customer.js --email <email> --name "<name>" --company "<company>" --plan <plan-slug>
Example: node scripts/api-create-customer.js --email josh@example.com --name "Joshua" --company "WildPhotography" --plan explorer
Plan slugs: explorer, professional, enterprise`);
  process.exit(0);
}

const { email, name, company, plan } = argv;

if (!email || !plan) {
  console.error('Error: --email and --plan are required.');
  console.error('Usage: node scripts/api-create-customer.js --email <email> --name "<name>" --company "<company>" --plan <plan-slug>');
  process.exit(1);
}

async function createCustomer() {
  // Resolve plan
  const plans = await sql`SELECT id, slug, name FROM api_plans WHERE slug = ${plan} LIMIT 1`;
  if (plans.length === 0) {
    console.error(`Plan '${plan}' not found. Available: explorer, professional, enterprise`);
    process.exit(1);
  }
  const planId = plans[0].id;

  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  try {
    const result = await sql`
      INSERT INTO api_customers (email, name, company, plan_id, status, current_period_start, current_period_end)
      VALUES (${email}, ${name || null}, ${company || null}, ${planId}, 'active', ${now}, ${periodEnd})
      RETURNING id, email, name, company, status
    `;

    console.log('Customer created:');
    console.log(`  ID: ${result[0].id}`);
    console.log(`  Email: ${result[0].email}`);
    console.log(`  Name: ${result[0].name || 'N/A'}`);
    console.log(`  Company: ${result[0].company || 'N/A'}`);
    console.log(`  Status: ${result[0].status}`);
    console.log(`  Plan: ${plan} (ID: ${planId})`);
    console.log(`  Period: ${now.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`);

    await sql`
      INSERT INTO api_audit_log (customer_id, action, metadata)
      VALUES (${result[0].id}, 'customer_created', ${JSON.stringify({ email, name, company, plan })}::jsonb)
    `;
  } catch (err) {
    if (err.message?.includes('unique') || err.message?.includes('duplicate') || err.code === '23505') {
      console.error(`Customer with email '${email}' already exists.`);
      process.exit(1);
    }
    throw err;
  }
}

createCustomer().catch(e => {
  console.error(e.message);
  process.exit(1);
});