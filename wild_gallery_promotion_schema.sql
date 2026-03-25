-- =============================================================
-- wild_gallery_promotion_schema.sql
-- Project 19: Editorial promotion logic for cross-gallery discovery
-- =============================================================
-- Run once against your Neon DB to enable gallery_type-based
-- promotion scoring in getGalleriesForPhoto().
-- =============================================================


-- ── Step 1: Add gallery_type column ───────────────────────────────────────
-- Values: 'species' | 'location' | 'region' | 'theme'
-- Default 'theme' so existing galleries degrade gracefully before backfill.

ALTER TABLE galleries
  ADD COLUMN IF NOT EXISTS gallery_type VARCHAR(20)
    DEFAULT 'theme'
    CHECK (gallery_type IN ('species', 'location', 'region', 'theme'));


-- ── Step 2: Add monetization flag ────────────────────────────────────────
-- true  → gallery has strong affiliate placement (location tours etc.)
-- false → no current monetization angle

ALTER TABLE galleries
  ADD COLUMN IF NOT EXISTS has_affiliate_content BOOLEAN DEFAULT FALSE;


-- ── Step 3: Index for efficient type-based queries ────────────────────────

CREATE INDEX IF NOT EXISTS idx_galleries_type
  ON galleries (gallery_type)
  WHERE is_active = true;


-- ── Step 4: Verify schema ─────────────────────────────────────────────────

SELECT id, slug, name, gallery_type, has_affiliate_content
FROM galleries
WHERE is_active = true
ORDER BY gallery_type, name;


-- =============================================================
-- BACKFILL INSTRUCTIONS
-- Replace slug values with your actual gallery slugs.
-- Run the SELECT at the bottom to audit scores after backfill.
-- =============================================================


-- ── Species galleries ─────────────────────────────────────────────────────
-- Exact-species or strong species content. No affiliate angle.

-- UPDATE galleries
--   SET gallery_type = 'species', has_affiliate_content = false
-- WHERE slug IN (
--   'scarlet-macaw',
--   'keel-billed-toucan',
--   'resplendent-quetzal',
--   'morpho-butterfly',
--   'poison-dart-frog',
--   'white-faced-capuchin'
-- );


-- ── Location galleries ────────────────────────────────────────────────────
-- Destination-based content. Strong affiliate match (tours, experiences).

-- UPDATE galleries
--   SET gallery_type = 'location', has_affiliate_content = true
-- WHERE slug IN (
--   'carara-national-park',
--   'arenal-volcano',
--   'monteverde',
--   'tortuguero',
--   'manuel-antonio',
--   'corcovado',
--   'la-selva'
-- );


-- ── Region galleries ──────────────────────────────────────────────────────
-- Broad geographic regions. Medium intent.

-- UPDATE galleries
--   SET gallery_type = 'region', has_affiliate_content = false
-- WHERE slug IN (
--   'central-valley',
--   'guanacaste',
--   'caribbean-coast',
--   'osa-peninsula',
--   'nicoya-peninsula'
-- );


-- ── Theme galleries ───────────────────────────────────────────────────────
-- Thematic / abstract groupings. Lower intent signal.

-- UPDATE galleries
--   SET gallery_type = 'theme', has_affiliate_content = false
-- WHERE slug IN (
--   'wildlife',
--   'birds-of-costa-rica',
--   'rainforest',
--   'macro',
--   'landscapes',
--   'best-of'
-- );


-- ── Step 5: Audit scores post-backfill ────────────────────────────────────
-- This query mirrors the promotion scoring logic in lib/gallery-ranking.ts
-- so you can verify expected scores before deploying.

SELECT
  g.slug,
  g.name,
  g.gallery_type,
  g.has_affiliate_content,
  (SELECT COUNT(*) FROM gallery_photos gp WHERE gp.gallery_id = g.id) AS photo_count,
  -- Simulate promotion score components
  CASE g.gallery_type
    WHEN 'species'  THEN 5  -- relevance
    WHEN 'location' THEN 4
    WHEN 'region'   THEN 2
    ELSE 1
  END AS relevance,
  CASE g.gallery_type
    WHEN 'location' THEN 5  -- intent
    WHEN 'species'  THEN 4
    WHEN 'region'   THEN 3
    ELSE 2
  END AS intent,
  CASE
    WHEN g.has_affiliate_content AND g.gallery_type = 'location' THEN 5  -- monetization
    WHEN g.gallery_type = 'location'                             THEN 4
    WHEN g.has_affiliate_content AND g.gallery_type = 'species'  THEN 4
    WHEN g.gallery_type = 'species'                              THEN 2
    WHEN g.has_affiliate_content                                 THEN 2
    ELSE 0
  END AS monetization
FROM galleries g
WHERE g.is_active = true
ORDER BY g.gallery_type, g.name;
