-- Migration: API customers, keys, and usage tracking
BEGIN;

-- ── API Customers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_customers (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES api_waitlist(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  company VARCHAR(255),
  website VARCHAR(500),
  plan_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  monthly_call_limit INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  onboarded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_customers_email ON api_customers(email);
CREATE INDEX IF NOT EXISTS idx_api_customers_status ON api_customers(status);
CREATE INDEX IF NOT EXISTS idx_api_customers_lead_id ON api_customers(lead_id);

-- ── API Keys ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES api_customers(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL,          -- SHA-256 hex of actual key
  key_prefix VARCHAR(16) NOT NULL,        -- first 12 chars for identification
  name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON api_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

-- ── Monthly Usage ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_monthly_usage (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES api_customers(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL,        -- '2026-05'
  call_count INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_customer_month ON api_monthly_usage(customer_id, year_month);

-- ── Customer Notes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_lead_notes (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES api_waitlist(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_lead_notes_lead ON api_lead_notes(lead_id);

COMMIT;