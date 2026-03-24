-- ============================================================
-- ROLLBACK SQL
-- Run this ONLY if something goes wrong after hostname replacement
-- ============================================================
-- This reverses the hostname replacement by swapping:
-- NEW_HOST -> OLD_HOST (broken)
-- ============================================================

-- WARNING: This will break images again!
-- Only use for rollback if needed

-- UPDATE photos SET 
--   thumb_url = REPLACE(thumb_url, 'pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev', 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev'),
--   small_url = REPLACE(small_url, 'pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev', 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev'),
--   medium_url = REPLACE(medium_url, 'pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev', 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev'),
--   large_url = REPLACE(large_url, 'pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev', 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev'),
--   preview_url = REPLACE(preview_url, 'pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev', 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev')
-- WHERE thumb_url LIKE '%pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev%';

-- ============================================================
-- FULL BACKUP BEFORE CHANGES
-- ============================================================

-- First, create a backup table (run once before any changes):
-- CREATE TABLE photos_url_backup_20260311 AS 
-- SELECT id, slug, thumb_url, small_url, medium_url, large_url, preview_url, updated_at
-- FROM photos;

-- To restore from backup:
-- UPDATE photos p SET
--   thumb_url = b.thumb_url,
--   small_url = b.small_url,
--   medium_url = b.medium_url,
--   large_url = b.large_url,
--   preview_url = b.preview_url
-- FROM photos_url_backup_20260311 b
-- WHERE p.id = b.id;
