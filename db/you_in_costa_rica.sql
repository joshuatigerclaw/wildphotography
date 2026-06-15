-- ============================================================
-- Migration: you_in_costa_rica_jobs
-- Purpose: AI photo personalization tool — "You in Costa Rica"
-- ============================================================

BEGIN;

-- Main jobs table
CREATE TABLE IF NOT EXISTS you_in_costa_rica_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email      TEXT,
    session_id      TEXT NOT NULL,

    -- Source background photo (WildPhotography photo used as scene)
    source_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    source_photo_slug TEXT,
    source_gallery_slug TEXT,
    source_r2_key  TEXT NOT NULL,
    source_cdn_url  TEXT,              -- pre-computed CDN URL for fast display

    -- User-uploaded photo
    uploaded_user_r2_key  TEXT NOT NULL,
    uploaded_user_mime    TEXT,
    uploaded_user_size    INTEGER,     -- bytes

    -- AI generation
    prompt              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (status IN (
            'uploaded',
            'processing',
            'free_ready',
            'payment_pending',
            'premium_ready',
            'failed',
            'deleted'
        )),

    -- Outputs
    free_output_r2_key   TEXT,
    premium_output_r2_key TEXT,
    watermark_applied     BOOLEAN DEFAULT TRUE,

    -- Stripe
    stripe_session_id     TEXT,
    stripe_payment_status TEXT,
    stripe_amount_cents   INTEGER,

    -- Error tracking
    error_message         TEXT,

    -- Bundle
    bundle_job_ids        UUID[],      -- for 3-pack bundle: links to other job IDs

    -- Timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_yicr_status          ON you_in_costa_rica_jobs(status);
CREATE INDEX IF NOT EXISTS idx_yicr_session_id      ON you_in_costa_rica_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_yicr_stripe_session  ON you_in_costa_rica_jobs(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yicr_created_at       ON you_in_costa_rica_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_yicr_source_photo_id  ON you_in_costa_rica_jobs(source_photo_id) WHERE source_photo_id IS NOT NULL;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_you_in_costa_rica_jobs_updated_at
    BEFORE UPDATE ON you_in_costa_rica_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;