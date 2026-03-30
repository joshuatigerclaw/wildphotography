-- WildPhotography AI description tracking fields
-- Adds provenance, locking, and quality tracking for Visionati-generated descriptions
--
-- Note: photos table does NOT have a 'category' column.
-- Use gallery_slug as the category proxy for candidate grouping.

ALTER TABLE photos
ADD COLUMN IF NOT EXISTS ai_description TEXT,
ADD COLUMN IF NOT EXISTS ai_description_source TEXT,
ADD COLUMN IF NOT EXISTS ai_description_model TEXT,
ADD COLUMN IF NOT EXISTS ai_description_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_description_status TEXT,
ADD COLUMN IF NOT EXISTS ai_description_word_count INT,
ADD COLUMN IF NOT EXISTS ai_description_version TEXT,
ADD COLUMN IF NOT EXISTS ai_description_review_notes TEXT,
ADD COLUMN IF NOT EXISTS description_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS description_last_manual_edit_at TIMESTAMPTZ;

-- Add missing indexes
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_photos_ai_description_status ON photos (ai_description_status);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_photos_description_locked ON photos (description_locked);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_photos_search_ready ON photos (search_ready);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_photos_ready_for_public_render ON photos (ready_for_public_render);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
