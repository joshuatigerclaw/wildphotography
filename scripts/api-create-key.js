#!/usr/bin/env node
/**
 * API Admin — Create API Key
 * Usage: node scripts/api-create-key.js --customer-id 1 --name "Production Key"
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

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
  console.log(`Usage: node scripts/api-create-key.js --customer-id <id> --name "<key-name>"
Example: node scripts/api-create-key.js --customer-id 1 --name "Production Key"`);
  process.exit(0);
}

const { 'customer-id': customerId, name } = argv;

if (!customerId) {
  console.error('Error: --customer-id is required.');
  console.error('Usage: node scripts/api-create-key.js --customer-id <id> --name "<key-name>"');
  process.exit(1);
}

function randomString(length) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

async function createApiKey() {
  const customers = await sql`SELECT id, email FROM api_customers WHERE id = ${parseInt(customerId)} LIMIT 1`;
  if (customers.length === 0) {
    console.error(`No customer found with ID '${customerId}'`);
    process.exit(1);
  }

  const cid = customers[0].id;
  const prefix = 'wild_live_' + randomString(8);
  const secret = randomString(32);
  const fullKey = `${prefix}_${secret}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  const result = await sql`
    INSERT INTO api_keys (customer_id, key_prefix, key_hash, name, status)
    VALUES (${cid}, ${prefix}, ${keyHash}, ${name || 'Default Key'}, 'active')
    RETURNING id, key_prefix, created_at
  `;

  console.log('API Key created:');
  console.log(`  Key ID: ${result[0].id}`);
  console.log(`  Customer ID: ${cid} (${customers[0].email})`);
  console.log(`  Name: ${name || 'Default Key'}`);
  console.log('');
  console.log('  FULL KEY: ' + fullKey);
  console.log('');
  console.log('⚠️  Save this key now — it will not be shown again!');

  await sql`
    INSERT INTO api_audit_log (customer_id, action, metadata)
    VALUES (${cid}, 'key_created', ${JSON.stringify({ key_id: result[0].id, name: name || 'Default Key', prefix })}::jsonb)
  `;
}

createApiKey().catch(e => {
  console.error(e.message);
  process.exit(1);
});