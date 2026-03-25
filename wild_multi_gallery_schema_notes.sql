-- ============================================================
-- WildPhotography — Multi-Gallery Schema Notes
-- ============================================================
-- Current status (2026-03-25):
--   Multi-gallery navigation is fully operational without schema changes.
--   Gallery context is propagated via ?fromGallery= URL param.
--   Fallback rule uses deterministic ORDER BY (sort_order ASC, id ASC).
--
-- This file documents optional schema additions for future use.
-- ============================================================


-- ── Current fallback rule (code-only, no schema change) ────────────────
--
-- When no fromGallery context is provided, getGalleryForPhoto uses:
--
--   ORDER BY gp.sort_order ASC NULLS LAST, g.id ASC
--   LIMIT 1
--
-- Priority:
--   1. gallery with the lowest sort_order (most prominent placement)
--   2. lowest gallery id as a final deterministic tiebreaker
--
-- This gives consistent, reproducible results for every direct-link hit.


-- ── Option A: is_primary_context flag (recommended future addition) ─────
--
-- Add a flag to gallery_photos so one gallery membership per photo can be
-- explicitly designated as the canonical fallback context.
--
-- When to add: once you have curated primary galleries for most photos,
-- or when editorial control over the fallback matters.

ALTER TABLE gallery_photos
  ADD COLUMN IF NOT EXISTS is_primary_context BOOLEAN NOT NULL DEFAULT false;

-- Enforce at most one primary context per photo
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_photos_primary_context
  ON gallery_photos (photo_id)
  WHERE is_primary_context = true;

-- Update getGalleryForPhoto fallback rule after adding this column:
--
--   ORDER BY gp.is_primary_context DESC,   -- explicit primary first
--            gp.sort_order ASC NULLS LAST,  -- then by prominence
--            g.id ASC                        -- then by id
--   LIMIT 1


-- ── Option B: is_featured flag (alternative) ───────────────────────────
--
-- A lighter-weight alternative: mark a gallery_photos row as featured
-- to indicate it should be used as the primary context.

ALTER TABLE gallery_photos
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;


-- ── Audit: photos belonging to more than one gallery ───────────────────

SELECT
  p.id          AS photo_id,
  p.slug        AS photo_slug,
  p.title       AS photo_title,
  COUNT(gp.gallery_id) AS gallery_count,
  STRING_AGG(g.name, ', ' ORDER BY gp.sort_order ASC NULLS LAST, g.id ASC) AS galleries
FROM photos p
JOIN gallery_photos gp ON p.id = gp.photo_id
JOIN galleries g       ON gp.gallery_id = g.id
WHERE p.is_active = true AND g.is_active = true
GROUP BY p.id, p.slug, p.title
HAVING COUNT(gp.gallery_id) > 1
ORDER BY gallery_count DESC, p.slug;


-- ── Audit: galleries with no sort_order set ────────────────────────────

SELECT
  g.id,
  g.slug,
  g.name,
  COUNT(gp.photo_id) FILTER (WHERE gp.sort_order IS NULL) AS photos_without_sort_order,
  COUNT(gp.photo_id) AS total_photos
FROM galleries g
LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id
WHERE g.is_active = true
GROUP BY g.id, g.slug, g.name
HAVING COUNT(gp.photo_id) FILTER (WHERE gp.sort_order IS NULL) > 0
ORDER BY photos_without_sort_order DESC;


-- ── Current multi-gallery precedence rules (summary) ───────────────────
--
-- 1. ORIGINATING GALLERY (always wins when present)
--    Source: ?fromGallery={gallery-slug} URL param
--    Set by: modal "View photo details" link, photo page prev/next links
--    Scope: navigation session until user explicitly switches context
--
-- 2. FALLBACK GALLERY (used when no fromGallery param present)
--    Rule: ORDER BY gp.sort_order ASC NULLS LAST, g.id ASC LIMIT 1
--    Future: ORDER BY is_primary_context DESC, sort_order ASC, g.id ASC
--
-- 3. NO GALLERY (photo not in any active gallery)
--    Behaviour: suppress context banner, nav bar, back link gracefully
--
-- ── Schema dependencies (current — no changes required) ────────────────
--   gallery_photos.sort_order  — already present, used for ordering
--   galleries.is_active        — already present, used for filtering
