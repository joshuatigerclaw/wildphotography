-- System health history table
CREATE TABLE IF NOT EXISTS system_health_history (
  id SERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Inventory snapshot
  typesense_count INTEGER NOT NULL,
  neon_eligible_count INTEGER NOT NULL,
  neon_total_count INTEGER NOT NULL,
  neon_ready_count INTEGER NOT NULL,
  neon_search_ready_count INTEGER NOT NULL,
  neon_derivatives_complete_count INTEGER NOT NULL,
  drift_pct DECIMAL(5,3) NOT NULL,
  
  -- Derivative integrity (100-sample check)
  derivative_sample_size INTEGER NOT NULL DEFAULT 100,
  derivative_thumb_missing INTEGER NOT NULL DEFAULT 0,
  derivative_small_missing INTEGER NOT NULL DEFAULT 0,
  derivative_medium_missing INTEGER NOT NULL DEFAULT 0,
  derivative_large_missing INTEGER NOT NULL DEFAULT 0,
  derivative_overall_fail_pct DECIMAL(5,3) NOT NULL,
  
  -- Search quality checks
  search_metrics JSONB NOT NULL DEFAULT '{"queries":{}}',
  
  -- Endpoint checks
  endpoint_checks JSONB NOT NULL DEFAULT '{}',
  
  -- Calculated alert flags (denormalized for fast queries)
  drift_alert BOOLEAN NOT NULL DEFAULT FALSE,
  derivative_alert BOOLEAN NOT NULL DEFAULT FALSE,
  search_drop_alert BOOLEAN NOT NULL DEFAULT FALSE,
  endpoint_alert BOOLEAN NOT NULL DEFAULT FALSE,
  overall_healthy BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Raw snapshot data for debugging
  snapshot_data JSONB
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_health_recorded_at ON system_health_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_alerts ON system_health_history(recorded_at DESC) WHERE NOT overall_healthy;
