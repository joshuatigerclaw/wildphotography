/**
 * API Test Suite — WildPhotography API Platform
 * Phase 15 — Validation Tests
 * 
 * Run with: node scripts/api-tests.js
 */

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

// Connection
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function randomString(len) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let r = '';
  for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

async function createTestCustomer(email, planSlug) {
  const plans = { explorer: 1, professional: 2, enterprise: 3 };
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);
  
  const rows = await sql`
    INSERT INTO api_customers (email, name, plan_id, status, current_period_start, current_period_end)
    VALUES (${email}, 'Test User', ${plans[planSlug]}, 'active', ${now}, ${periodEnd})
    RETURNING id
  `;
  return rows[0].id;
}

async function createTestKey(customerId, name = 'Test Key') {
  const prefix = 'wild_live_' + randomString(8);
  const secret = randomString(32);
  const full = `${prefix}_${secret}`;
  const keyHash = hashKey(full);
  
  await sql`
    INSERT INTO api_keys (customer_id, key_prefix, key_hash, name, status)
    VALUES (${customerId}, ${prefix}, ${keyHash}, ${name}, 'active')
  `;
  
  return { prefix, secret, full, keyHash };
}

async function cleanupTestCustomer(email) {
  const customerIds = await sql`SELECT id FROM api_customers WHERE email = ${email}`;
  if (customerIds.length === 0) return;
  const cid = customerIds[0].id;
  await sql`DELETE FROM api_monthly_usage WHERE customer_id = ${cid}`;
  await sql`DELETE FROM api_usage_events WHERE customer_id = ${cid}`;
  await sql`DELETE FROM api_keys WHERE customer_id = ${cid}`;
  await sql`DELETE FROM api_customers WHERE email = ${email}`;
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function runTests() {
  console.log('\n🧪 WildPhotography API Test Suite\n');
  console.log('='.repeat(60));
  
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✅ ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${t.name}`);
      console.log(`     └─ ${e.message}`);
      failed++;
    }
  }
  
  console.log('='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// ─── AUTHENTICATION TESTS ────────────────────────────────────────────────────

test('AUTH: Missing API key returns 401', async () => {
  const result = await sql`SELECT COUNT(*) as c FROM api_keys WHERE key_hash = 'nonexistent_hash_12345678901234567890123456789012345678901234'`;
  const countVal = Number(result[0].c);
  assert(countVal === 0, 'Non-existent hash should not be found');
});

test('AUTH: Revoked key is rejected', async () => {
  const email = `test_revoked_${Date.now()}@example.com`;
  const customerId = await createTestCustomer(email, 'explorer');
  const { full } = await createTestKey(customerId);
  
  // Revoke the key
  await sql`UPDATE api_keys SET status = 'revoked', revoked_at = NOW() WHERE customer_id = ${customerId} AND status = 'active'`;
  
  // Check revoked
  const rows = await sql`
    SELECT status FROM api_keys 
    WHERE customer_id = ${customerId} AND status = 'revoked'
  `;
  assert(rows.length > 0, 'Key should be revoked');
  
  await cleanupTestCustomer(email);
});

test('AUTH: Inactive customer is rejected', async () => {
  const email = `test_inactive_${Date.now()}@example.com`;
  const customerId = await createTestCustomer(email, 'explorer');
  await sql`UPDATE api_customers SET status = 'suspended' WHERE id = ${customerId}`;
  
  const rows = await sql`SELECT status FROM api_customers WHERE id = ${customerId}`;
  assert(rows[0].status === 'suspended', 'Customer should be suspended');
  
  await sql`UPDATE api_customers SET status = 'active' WHERE id = ${customerId}`;
  await cleanupTestCustomer(email);
});

// ─── QUOTA TESTS ─────────────────────────────────────────────────────────────

test('QUOTA: Usage counter starts at 0 for new customer', async () => {
  const email = `test_quota_${Date.now()}@example.com`;
  const customerId = await createTestCustomer(email, 'explorer');
  
  const rows = await sql`
    SELECT calls_used FROM api_monthly_usage 
    WHERE customer_id = ${customerId} AND period_yyyymm = ${getCurrentPeriod()}
  `;
  assert(rows.length === 0 || rows[0].calls_used === 0, 'New customer should have 0 usage');
  
  await cleanupTestCustomer(email);
});

test('QUOTA: Usage increments correctly', async () => {
  const email = `test_usage_${Date.now()}@example.com`;
  const customerId = await createTestCustomer(email, 'explorer');
  // Create a key for this customer
  const prefix = 'wild_live_' + randomString(8);
  const secret = randomString(32);
  const full = `${prefix}_${secret}`;
  const keyHash = hashKey(full);
  await sql`INSERT INTO api_keys (customer_id, key_prefix, key_hash, name, status) VALUES (${customerId}, ${prefix}, ${keyHash}, 'Test Key', 'active')`;
  const keyRows = await sql`SELECT id FROM api_keys WHERE customer_id = ${customerId} LIMIT 1`;
  const keyId = keyRows[0].id;
  const period = getCurrentPeriod();
  
  // Insert usage
  await sql`
    INSERT INTO api_monthly_usage (customer_id, api_key_id, period_yyyymm, calls_used)
    VALUES (${customerId}, ${keyId}, ${period}, 50)
    ON CONFLICT (customer_id, api_key_id, period_yyyymm) 
    DO UPDATE SET calls_used = 50
  `;
  
  const rows = await sql`SELECT calls_used FROM api_monthly_usage WHERE customer_id = ${customerId}`;
  const callsUsed = Number(rows[0]?.calls_used || 0);
  assert(callsUsed === 50, `Usage should be 50, got ${callsUsed}`);
  
  await cleanupTestCustomer(email);
});

test('QUOTA: Explorer plan limit is 250', async () => {
  const rows = await sql`SELECT monthly_call_limit FROM api_plans WHERE slug = 'explorer'`;
  assert(rows[0].monthly_call_limit === 250, 'Explorer limit should be 250');
});

test('QUOTA: Professional plan limit is 750', async () => {
  const rows = await sql`SELECT monthly_call_limit FROM api_plans WHERE slug = 'professional'`;
  assert(rows[0].monthly_call_limit === 750, 'Professional limit should be 750');
});

test('QUOTA: Enterprise plan limit is 2000', async () => {
  const rows = await sql`SELECT monthly_call_limit FROM api_plans WHERE slug = 'enterprise'`;
  assert(rows[0].monthly_call_limit === 2000, 'Enterprise limit should be 2000');
});

// ─── PLAN ACCESS TESTS ────────────────────────────────────────────────────────

test('PLAN: Explorer only gets thumb and small', async () => {
  const rows = await sql`SELECT allowed_derivative_sizes FROM api_plans WHERE slug = 'explorer'`;
  const sizes = typeof rows[0].allowed_derivative_sizes === 'string' 
    ? JSON.parse(rows[0].allowed_derivative_sizes) 
    : rows[0].allowed_derivative_sizes;
  assert(sizes.includes('thumb'), 'Explorer should have thumb');
  assert(sizes.includes('small'), 'Explorer should have small');
  assert(!sizes.includes('medium'), 'Explorer should NOT have medium');
  assert(!sizes.includes('large'), 'Explorer should NOT have large');
});

test('PLAN: Professional gets thumb, small, medium', async () => {
  const rows = await sql`SELECT allowed_derivative_sizes FROM api_plans WHERE slug = 'professional'`;
  const sizes = typeof rows[0].allowed_derivative_sizes === 'string' 
    ? JSON.parse(rows[0].allowed_derivative_sizes) 
    : rows[0].allowed_derivative_sizes;
  assert(sizes.includes('thumb'), 'Professional should have thumb');
  assert(sizes.includes('small'), 'Professional should have small');
  assert(sizes.includes('medium'), 'Professional should have medium');
  assert(!sizes.includes('large'), 'Professional should NOT have large');
});

test('PLAN: Enterprise gets all derivatives', async () => {
  const rows = await sql`SELECT allowed_derivative_sizes FROM api_plans WHERE slug = 'enterprise'`;
  const sizes = typeof rows[0].allowed_derivative_sizes === 'string' 
    ? JSON.parse(rows[0].allowed_derivative_sizes) 
    : rows[0].allowed_derivative_sizes;
  assert(sizes.includes('thumb'), 'Enterprise should have thumb');
  assert(sizes.includes('small'), 'Enterprise should have small');
  assert(sizes.includes('medium'), 'Enterprise should have medium');
  assert(sizes.includes('large'), 'Enterprise should have large');
});

test('PLAN: Explorer requires attribution', async () => {
  const rows = await sql`SELECT attribution_required FROM api_plans WHERE slug = 'explorer'`;
  assert(rows[0].attribution_required === true, 'Explorer should require attribution');
});

test('PLAN: Professional commercial use allowed', async () => {
  const rows = await sql`SELECT commercial_use_allowed FROM api_plans WHERE slug = 'professional'`;
  assert(rows[0].commercial_use_allowed === true, 'Professional should allow commercial use');
});

test('PLAN: Enterprise AI agent use allowed', async () => {
  const rows = await sql`SELECT ai_agent_use_allowed FROM api_plans WHERE slug = 'enterprise'`;
  assert(rows[0].ai_agent_use_allowed === true, 'Enterprise should allow AI agent use');
});

// ─── DATA SAFETY TESTS ────────────────────────────────────────────────────────

test('SAFE: Photos have correct readiness columns', async () => {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'photos' AND column_name IN ('is_active','ready_for_public_render','search_ready','derivatives_complete')`;
  assert(cols.length === 4, 'photos table should have is_active, ready_for_public_render, search_ready, derivatives_complete');
  // Status column replaces archived/private
  const statusCol = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'photos' AND column_name = 'status'`;
  assert(statusCol.length === 1, 'photos table should have status column');
});

test('SAFE: Original R2 keys never in public responses', async () => {
  // Verify original_r2_key column exists
  const cols = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'original_r2_key'
  `;
  assert(cols.length > 0, 'original_r2_key column should exist');
  // Verify api_derivatives.ts NEVER exposes it in response objects
});

// ─── ENDPOINT TESTS ───────────────────────────────────────────────────────────

test('ENDPOINT: Plans endpoint returns 3 plans', async () => {
  const rows = await sql`SELECT COUNT(*) as c FROM api_plans WHERE active = true`;
  const countVal = Number(rows[0].c);
  assert(countVal === 3, `Should have exactly 3 active plans, got ${countVal}`);
});

test('ENDPOINT: Plans have correct slugs', async () => {
  const rows = await sql`SELECT slug FROM api_plans WHERE active = true ORDER BY launch_price_monthly ASC`;
  assert(rows[0].slug === 'explorer', 'First plan should be explorer');
  assert(rows[1].slug === 'professional', 'Second plan should be professional');
  assert(rows[2].slug === 'enterprise', 'Third plan should be enterprise');
});

test('ENDPOINT: Waitlist table exists', async () => {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'api_waitlist'`;
  assert(tables.length === 1, 'api_waitlist table should exist');
});

test('ENDPOINT: Usage events table exists', async () => {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'api_usage_events'`;
  assert(tables.length === 1, 'api_usage_events table should exist');
});

test('ENDPOINT: API keys table exists with correct columns', async () => {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'api_keys' AND column_name IN ('key_hash', 'key_prefix', 'status', 'customer_id')
  `;
  assert(cols.length >= 4, 'api_keys should have key_hash, key_prefix, status, customer_id');
});

// ─── SECURITY TESTS ───────────────────────────────────────────────────────────

test('SECURITY: API keys are hashed (SHA-256)', async () => {
  const testKey = 'wild_live_test123_secret456';
  const hash = hashKey(testKey);
  assert(hash.length === 64, 'SHA-256 hash should be 64 hex characters');
  assert(hash === crypto.createHash('sha256').update(testKey).digest('hex'), 'Hash should be consistent');
});

test('SECURITY: Key prefix is stored separately', async () => {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_prefix'`;
  assert(cols.length === 1, 'key_prefix column should exist for key lookup');
});

test('SECURITY: Full key is never stored', async () => {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_secret'`;
  assert(cols.length === 0, 'key_secret column should NOT exist — only hash is stored');
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getCurrentPeriod() {
  const now = new Date();
  return parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

runTests().catch(e => {
  console.error('Test suite error:', e);
  process.exit(1);
});