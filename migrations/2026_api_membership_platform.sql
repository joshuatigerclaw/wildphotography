-- ============================================================
-- API Membership Platform Migration
-- WildPhotography.com — Phase 2 Database Schema
-- ============================================================

-- API Plans
CREATE TABLE IF NOT EXISTS api_plans (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  regular_price_monthly INTEGER NOT NULL,  -- cents
  launch_price_monthly INTEGER NOT NULL,   -- cents
  monthly_call_limit INTEGER NOT NULL,
  allowed_derivative_sizes JSONB NOT NULL, -- ["thumb","small"] etc.
  attribution_required BOOLEAN NOT NULL DEFAULT true,
  commercial_use_allowed BOOLEAN NOT NULL DEFAULT false,
  ai_agent_use_allowed BOOLEAN NOT NULL DEFAULT false,
  max_results_default INTEGER NOT NULL DEFAULT 20,
  max_results_limit INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Customers
CREATE TABLE IF NOT EXISTS api_customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  company VARCHAR(255),
  stripe_customer_id VARCHAR(255) UNIQUE,
  plan_id INTEGER REFERENCES api_plans(id),
  status VARCHAR(30) NOT NULL DEFAULT 'active',  -- active, suspended, cancelled, trialing
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES api_customers(id) ON DELETE CASCADE,
  key_prefix VARCHAR(20) NOT NULL,           -- wild_live_prefix
  key_hash VARCHAR(64) NOT NULL,             -- SHA-256 of full key
  name VARCHAR(100) DEFAULT 'Default Key',
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, revoked
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- API Usage Events
CREATE TABLE IF NOT EXISTS api_usage_events (
  id BIGSERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES api_customers(id),
  api_key_id INTEGER REFERENCES api_keys(id),
  endpoint VARCHAR(50) NOT NULL,
  request_path TEXT NOT NULL,
  response_status INTEGER,
  units_used INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_hash VARCHAR(64),
  user_agent_hash VARCHAR(64)
);

-- API Monthly Usage (rollup)
CREATE TABLE IF NOT EXISTS api_monthly_usage (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES api_customers(id),
  api_key_id INTEGER REFERENCES api_keys(id),
  period_yyyymm INTEGER NOT NULL,  -- e.g. 202605
  calls_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, api_key_id, period_yyyymm)
);

-- API Audit Log
CREATE TABLE IF NOT EXISTS api_audit_log (
  id BIGSERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES api_customers(id),
  action VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Waitlist (for pre-Stripe signup)
CREATE TABLE IF NOT EXISTS api_waitlist (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  intended_use TEXT,
  selected_plan VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON api_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_customers_email ON api_customers(email);
CREATE INDEX IF NOT EXISTS idx_api_customers_stripe ON api_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_events_customer ON api_usage_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_events_created ON api_usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_api_monthly_usage_customer_period ON api_monthly_usage(customer_id, period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_api_audit_log_customer ON api_audit_log(customer_id);

-- ============================================================
-- SEED: Three API Plans
-- ============================================================

INSERT INTO api_plans (slug, name, regular_price_monthly, launch_price_monthly, monthly_call_limit, allowed_derivative_sizes, attribution_required, commercial_use_allowed, ai_agent_use_allowed, max_results_default, max_results_limit)
VALUES
  (
    'explorer',
    'Explorer Developer',
    4900,   -- $49/month regular
    2400,   -- $24/month launch
    250,
    '["thumb", "small"]'::jsonb,
    true,
    false,
    false,
    20,
    25
  ),
  (
    'professional',
    'Professional Tourism',
    19900,  -- $199/month regular
    9900,   -- $99/month launch
    750,
    '["thumb", "small", "medium"]'::jsonb,
    false,
    true,
    false,
    20,
    50
  ),
  (
    'enterprise',
    'AI & Enterprise Vision',
    99900,  -- $999/month regular
    49900,  -- $499/month launch
    2000,
    '["thumb", "small", "medium", "large"]'::jsonb,
    false,
    true,
    true,
    20,
    100
  )
ON CONFLICT (slug) DO NOTHING;

-- Migration record
INSERT INTO schema_migrations (migration_name, applied_at)
VALUES ('2026_api_membership_platform', NOW())
ON CONFLICT (migration_name) DO NOTHING;