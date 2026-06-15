-- migrations/0001_api_auth.sql
-- D1 schema for API authentication and usage tracking
-- SQLite (D1) equivalent of public.api_customers, api_keys, api_monthly_usage

-- api_customers: API customer accounts
CREATE TABLE IF NOT EXISTS api_customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT,
  company         TEXT,
  stripe_customer_id TEXT,
  plan_id         INTEGER,
  plan_name       TEXT NOT NULL,
  monthly_call_limit INTEGER NOT NULL DEFAULT 1000,
  status          TEXT NOT NULL DEFAULT 'active',   -- active, suspended, cancelled
  current_period_start DATETIME,
  current_period_end   DATETIME,
  website         TEXT,
  lead_id         INTEGER,
  onboarded_at    DATETIME,
  created_at      DATETIME DEFAULT (datetime('now')),
  updated_at      DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_customers_email ON api_customers(email);
CREATE INDEX IF NOT EXISTS idx_api_customers_status ON api_customers(status);

-- api_keys: API key registry (stores key_hash, NOT raw keys)
CREATE TABLE IF NOT EXISTS api_keys (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL,
  key_prefix      TEXT NOT NULL,   -- first 8 chars of key for display
  key_hash        TEXT NOT NULL UNIQUE,  -- SHA-256 of full key
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active, revoked
  last_used_at    DATETIME,
  created_at      DATETIME DEFAULT (datetime('now')),
  revoked_at      DATETIME,
  FOREIGN KEY (customer_id) REFERENCES api_customers(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_customer_id ON api_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

-- api_monthly_usage: monthly API call counters per customer
CREATE TABLE IF NOT EXISTS api_monthly_usage (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL,
  api_key_id      INTEGER,
  period_yyyymm   INTEGER NOT NULL,   -- 202606 = June 2026
  calls_used      INTEGER NOT NULL DEFAULT 0,
  updated_at      DATETIME DEFAULT (datetime('now')),
  UNIQUE(customer_id, period_yyyymm),
  FOREIGN KEY (customer_id) REFERENCES api_customers(id),
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE INDEX IF NOT EXISTS idx_api_monthly_usage_customer_period ON api_monthly_usage(customer_id, period_yyyymm);

-- Migration helper: insert-or-replace for api_keys
-- Usage: INSERT OR REPLACE INTO api_keys (...) VALUES (...)
