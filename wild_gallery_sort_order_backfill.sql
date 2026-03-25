-- ===========================================================
-- WildPhotography: Gallery Sort Order Backfill
-- ===========================================================
-- Run this once to populate sort_order for any gallery_photos
-- rows that currently have NULL sort_order.
--
-- Canonical priority:
--   1. Preserve any existing explicit sort_order values
--   2. Fall back to photo.date_uploaded ASC (chronological)
--   3. Final tiebreaker: photo.id ASC (stable)
--
-- Safe to re-run: only touches rows WHERE sort_order IS NULL
-- ===========================================================

-- ── Step 1: Audit — count galleries with missing sort_order
-- Run this first to see how many rows need backfilling.
SELECT
    g.id          AS gallery_id,
    g.name        AS gallery_name,
    g.slug        AS gallery_slug,
    COUNT(gp.photo_id)                                              AS total_photos,
    COUNT(*) FILTER (WHERE gp.sort_order IS NULL)                  AS missing_sort_order,
    COUNT(*) FILTER (WHERE gp.sort_order IS NOT NULL)              AS has_sort_order
FROM galleries g
JOIN gallery_photos gp ON g.id = gp.gallery_id
GROUP BY g.id, g.name, g.slug
HAVING COUNT(*) FILTER (WHERE gp.sort_order IS NULL) > 0
ORDER BY missing_sort_order DESC;


-- ── Step 2: Backfill missing sort_order values
-- Assigns sort_order based on date_uploaded ASC → id ASC within
-- each gallery, starting numbering from 1 and leaving gaps for
-- any rows that already have an explicit sort_order.
--
-- Strategy:
--   • Rows WITH sort_order are left untouched.
--   • Rows WITHOUT sort_order get assigned sequential values
--     starting at (max existing sort_order in gallery + 1000),
--     ensuring backfilled values don't collide with existing ones.
-- ===========================================================

WITH ranked AS (
    SELECT
        gp.gallery_id,
        gp.photo_id,
        ROW_NUMBER() OVER (
            PARTITION BY gp.gallery_id
            ORDER BY p.date_uploaded ASC NULLS LAST, p.id ASC
        ) AS rn,
        -- Offset from max existing sort_order to avoid collisions
        COALESCE(
            (SELECT MAX(gp2.sort_order)
             FROM gallery_photos gp2
             WHERE gp2.gallery_id = gp.gallery_id
               AND gp2.sort_order IS NOT NULL),
            0
        ) AS max_existing
    FROM gallery_photos gp
    JOIN photos p ON gp.photo_id = p.id
    WHERE gp.sort_order IS NULL
)
UPDATE gallery_photos gp
SET sort_order = ranked.max_existing + (ranked.rn * 10)
FROM ranked
WHERE gp.gallery_id = ranked.gallery_id
  AND gp.photo_id = ranked.photo_id;


-- ── Step 3: Full re-sequence (optional, run only if you want
--    clean contiguous 10-step sort_orders for all galleries)
-- WARNING: This OVERWRITES all existing sort_order values.
-- Only run this if you want a clean reset. Comment out unless needed.
/*
WITH ranked AS (
    SELECT
        gp.gallery_id,
        gp.photo_id,
        ROW_NUMBER() OVER (
            PARTITION BY gp.gallery_id
            ORDER BY p.date_uploaded ASC NULLS LAST, p.id ASC
        ) AS rn
    FROM gallery_photos gp
    JOIN photos p ON gp.photo_id = p.id
)
UPDATE gallery_photos gp
SET sort_order = ranked.rn * 10
FROM ranked
WHERE gp.gallery_id = ranked.gallery_id
  AND gp.photo_id = ranked.photo_id;
*/


-- ── Step 4: Verify — confirm no NULLs remain
SELECT
    COUNT(*) FILTER (WHERE sort_order IS NULL)     AS still_null,
    COUNT(*) FILTER (WHERE sort_order IS NOT NULL) AS now_set,
    COUNT(*)                                        AS total
FROM gallery_photos;


-- ── Step 5: Spot-check a gallery sequence
-- Replace 'your-gallery-slug' with a real gallery slug to inspect.
/*
SELECT
    g.slug  AS gallery,
    p.slug  AS photo_slug,
    p.title,
    gp.sort_order,
    p.date_uploaded
FROM gallery_photos gp
JOIN galleries g ON gp.gallery_id = g.id
JOIN photos p    ON gp.photo_id   = p.id
WHERE g.slug = 'your-gallery-slug'
ORDER BY gp.sort_order ASC NULLS LAST, p.date_uploaded ASC NULLS LAST, p.id ASC;
*/
