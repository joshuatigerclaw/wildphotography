#!/usr/bin/env node
/**
 * API Admin — Seed Plans
 * Usage: node scripts/api-seed-plans.js
 * Idempotent: ON CONFLICT DO NOTHING
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
  console.log(`Usage: node scripts/api-seed-plans.js
Seeds 3 plans: Explorer ($24/$49, 250 calls), Professional ($99/$199, 750 calls), Enterprise ($499/$999, 2000 calls).
Idempotent — safe to run multiple times.`);
  process.exit(0);
}

async function seedPlans() {
  console.log('Seeding API plans...');

  const plans = [
    {
      slug: 'explorer',
      name: 'Explorer Developer',
      regular_price_monthly: 4900,
      launch_price_monthly: 2400,
      monthly_call_limit: 250,
      allowed_derivative_sizes: ['thumb', 'small'],
      attribution_required: true,
      commercial_use_allowed: false,
      ai_agent_use_allowed: false,
      max_results_default: 20,
      max_results_limit: 25,
    },
    {
      slug: 'professional',
      name: 'Professional Tourism',
      regular_price_monthly: 19900,
      launch_price_monthly: 9900,
      monthly_call_limit: 750,
      allowed_derivative_sizes: ['thumb', 'small', 'medium'],
      attribution_required: false,
      commercial_use_allowed: true,
      ai_agent_use_allowed: false,
      max_results_default: 20,
      max_results_limit: 50,
    },
    {
      slug: 'enterprise',
      name: 'AI & Enterprise Vision',
      regular_price_monthly: 99900,
      launch_price_monthly: 49900,
      monthly_call_limit: 2000,
      allowed_derivative_sizes: ['thumb', 'small', 'medium', 'large'],
      attribution_required: false,
      commercial_use_allowed: true,
      ai_agent_use_allowed: true,
      max_results_default: 20,
      max_results_limit: 100,
    },
  ];

  for (const p of plans) {
    const result = await sql`
      INSERT INTO api_plans (slug, name, regular_price_monthly, launch_price_monthly, monthly_call_limit, allowed_derivative_sizes, attribution_required, commercial_use_allowed, ai_agent_use_allowed, max_results_default, max_results_limit)
      VALUES (
        ${p.slug}, ${p.name}, ${p.regular_price_monthly}, ${p.launch_price_monthly},
        ${p.monthly_call_limit}, ${JSON.stringify(p.allowed_derivative_sizes)}::jsonb,
        ${p.attribution_required}, ${p.commercial_use_allowed}, ${p.ai_agent_use_allowed},
        ${p.max_results_default}, ${p.max_results_limit}
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        regular_price_monthly = EXCLUDED.regular_price_monthly,
        launch_price_monthly = EXCLUDED.launch_price_monthly,
        monthly_call_limit = EXCLUDED.monthly_call_limit,
        allowed_derivative_sizes = EXCLUDED.allowed_derivative_sizes,
        attribution_required = EXCLUDED.attribution_required,
        commercial_use_allowed = EXCLUDED.commercial_use_allowed,
        ai_agent_use_allowed = EXCLUDED.ai_agent_use_allowed,
        max_results_default = EXCLUDED.max_results_default,
        max_results_limit = EXCLUDED.max_results_limit,
        updated_at = NOW()
      RETURNING slug, name, launch_price_monthly/100 as launch_price, regular_price_monthly/100 as regular_price, monthly_call_limit as calls
    `;
    console.log(`  ✓ ${result[0].name} — $${result[0].launch_price}/mo ($${result[0].regular_price} mo) — ${result[0].calls} calls/mo`);
  }

  console.log('\nAll plans seeded successfully.');
}

seedPlans().catch(e => {
  console.error(e.message);
  process.exit(1);
});