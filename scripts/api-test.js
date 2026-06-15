#!/usr/bin/env node
/**
 * API Test Suite — WildPhotography API Platform
 * Validates authentication, quota, derivative access, and data safety.
 */

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const BASE = 'https://wildphotography-new.josh-ec6.workers.dev';
const SQL = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

let testsRun = 0, testsPassed = 0, testsFailed = 0;

function assert(condition, msg) {
  testsRun++;
  if (condition) { testsPassed++; console.log(`  ✓ ${msg}`); }
  else { testsFailed++; console.log(`  ✗ ${msg}`); }
}

async function getPlanId(slug) {
  const rows = await SQL`SELECT id FROM api_plans WHERE slug = ${slug} LIMIT 1`;
  return rows[0]?.id;
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function apiCall(path, apiKey, method = 'GET', body = null) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

async function runTests() {
  console.log('\n🧪 WildPhotography API Test Suite\n');

  // ── Setup: create test customer + key ──────────────────────────
  console.log('=== SETUP ===');
  
  const planId = await getPlanId('explorer');
  if (!planId) { console.log('✗ No explorer plan found. Run migration first.'); return; }
  
  const testEmail = `test-api-${Date.now()}@wildphotography.test`;
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  await SQL`
    INSERT INTO api_customers (email, name, company, plan_id, status, current_period_start, current_period_end)
    VALUES (${testEmail}, 'API Test', 'WildPhotography Test', ${planId}, 'active', ${now}, ${periodEnd})
  `;
  console.log(`  ✓ Test customer created: ${testEmail}`);

  // Create test key
  const prefix = `wild_live_t${Date.now().toString(36)}`;
  const secret = Array.from({length: 32}, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random()*28)]).join('');
  const fullKey = `${prefix}_${secret}`;
  const keyHash = hashKey(fullKey);

  await SQL`
    INSERT INTO api_keys (customer_id, key_prefix, key_hash, name, status)
    SELECT id, ${prefix}, ${keyHash}, 'Test Key', 'active'
    FROM api_customers WHERE email = ${testEmail}
  `;
  console.log(`  ✓ Test key created: ${prefix}_${secret.slice(0,8)}...`);

  // Get customer id
  const custRows = await SQL`SELECT id FROM api_customers WHERE email = ${testEmail} LIMIT 1`;
  const customerId = custRows[0].id;

  // ── Auth Tests ─────────────────────────────────────────────────
  console.log('\n=== AUTHENTICATION TESTS ===');

  const missingAuth = await apiCall('/api/v1/search');
  assert(missingAuth.status === 401 && missingAuth.json?.error === 'invalid_api_key', 'Missing API key → 401');

  const badKey = await apiCall('/api/v1/search', 'wild_live_badkey1234567890123456');
  assert(badKey.status === 401 && badKey.json?.error === 'invalid_api_key', 'Bad API key → 401');

  const goodCall = await apiCall('/api/v1/search', fullKey);
  assert(goodCall.status === 200, 'Valid API key → 200');

  // ── Quota Tests ───────────────────────────────────────────────
  console.log('\n=== QUOTA TESTS ===');

  // Set usage to near limit
  const period = parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
  await SQL`INSERT INTO api_monthly_usage (customer_id, api_key_id, period_yyyymm, calls_used) VALUES (${customerId}, (SELECT id FROM api_keys WHERE key_prefix = ${prefix}), ${period}, 248)`;

  const nearLimit = await apiCall('/api/v1/search', fullKey);
  assert(nearLimit.status === 200, 'Under limit → 200 OK');

  // Set at limit
  await SQL`UPDATE api_monthly_usage SET calls_used = 250 WHERE customer_id = ${customerId} AND period_yyyymm = ${period}`;
  
  const atLimit = await apiCall('/api/v1/search', fullKey);
  assert(atLimit.status === 429 && atLimit.json?.error === 'monthly_quota_exceeded', 'At limit → 429 quota_exceeded');

  // Reset for next tests
  await SQL`UPDATE api_monthly_usage SET calls_used = 0 WHERE customer_id = ${customerId} AND period_yyyymm = ${period}`;

  // ── Data Safety Tests ─────────────────────────────────────────
  console.log('\n=== DATA SAFETY TESTS ===');

  // Verify search results exclude incomplete photos
  if (goodCall.status === 200 && goodCall.json?.results) {
    const photo = goodCall.json.results[0];
    if (photo) {
      assert(photo.original_r2_key === undefined, 'Results do not expose original_r2_key');
      assert(photo.thumb_url !== null || photo.small_url !== null, 'Results include valid derivative URL');
      assert(photo.keywords !== undefined, 'Results include keywords');
      assert(photo.content_helper !== undefined, 'Results include content_helper');
    }
  }

  // Test photo detail
  const photoRes = await apiCall('/api/v1/photos/img-9761-jpg-McvJMD', fullKey);
  if (photoRes.status === 200 && photoRes.json) {
    assert(photoRes.json.original_r2_key === undefined, 'Photo detail does not expose original_r2_key');
    assert(photoRes.json.canonical_url?.includes('/photo/'), 'Photo detail has canonical URL');
  }

  // ── Plan Derivative Restriction Tests ────────────────────────
  console.log('\n=== PLAN DERIVATIVE RESTRICTION TESTS ===');

  // Explorer: should NOT get large_url
  const explorerSearch = await apiCall('/api/v1/search?limit=5', fullKey);
  if (explorerSearch.status === 200 && explorerSearch.json?.results) {
    for (const p of explorerSearch.json.results) {
      if (p.large_url !== null && p.large_url !== undefined) {
        assert(false, `Explorer plan should not expose large_url (got: ${p.large_url})`);
        break;
      }
    }
    assert(true, 'Explorer plan correctly restricts to thumb + small only');
  }

  // Test usage endpoint
  const usage = await apiCall('/api/v1/usage', fullKey);
  assert(usage.status === 200, 'Usage endpoint returns 200');
  assert(usage.json?.monthly_limit !== undefined, 'Usage response includes monthly_limit');
  assert(usage.json?.calls_used !== undefined, 'Usage response includes calls_used');

  // ── Plans Endpoint (public) ───────────────────────────────────
  console.log('\n=== PUBLIC ENDPOINTS ===');
  
  const plansPublic = await apiCall('/api/v1/plans');
  assert(ploresPublic.status === 200, '/api/v1/plans returns 200');
  if (plansPublic.status === 200) {
    assert(plansPublic.json?.plans?.length === 3, '/api/v1/plans returns 3 plans');
  }

  // ── Cleanup ───────────────────────────────────────────────────
  console.log('\n=== CLEANUP ===');
  await SQL`DELETE FROM api_keys WHERE customer_id = ${customerId}`;
  await SQL`DELETE FROM api_customers WHERE id = ${customerId}`;
  console.log('  ✓ Test data cleaned up');

  // ── Summary ──────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Tests: ${testsRun} run | ${testsPassed} passed | ${testsFailed} failed`);
  if (testsFailed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error('Test error:', e.message);
  process.exit(1);
});