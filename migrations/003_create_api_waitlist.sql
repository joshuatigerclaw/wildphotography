-- Migration: Create api_waitlist table for API Access early access applications
BEGIN;

CREATE TABLE IF NOT EXISTS api_waitlist (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  website VARCHAR(500),
  selected_plan VARCHAR(50) NOT NULL,
  intended_use TEXT,
  monthly_api_needs VARCHAR(100),
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_waitlist_email ON api_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_api_waitlist_status ON api_waitlist(status);

COMMIT;