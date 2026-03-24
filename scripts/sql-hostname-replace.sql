-- ============================================================
-- HOSTNAME REPLACEMENT SQL
-- Run this AFTER derivatives are successfully restored to R2
-- ============================================================
-- 
-- This updates all photo URLs to point to the new R2 public hostname
-- 
-- PREREQUISITES:
--   1. Run restore-derivatives.js to upload all derivatives to R2
--   2. Verify uploads with verify-restoration.js
--   3. Get the new public hostname from Cloudflare R2 dashboard
--
-- ============================================================

-- STEP 1: Preview changes
-- Replace 'YOUR_NEW_HOSTNAME' with actual new hostname
-- Run this SELECT to verify what will change:

-- \set new_host 'pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev'
-- 
-- SELECT 
--   id,
--   slug,
--   thumb_url as old_thumb,
--   REPLACE(thumb_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', :new_host) as new_thumb
-- FROM photos 
-- WHERE thumb_url LIKE '%pub-7d412c6efb5943b5bc587e695e22001e.r2.dev%'
-- LIMIT 10;

-- ============================================================
-- STEP 2: EXECUTE (after verification)
-- ============================================================

-- UPDATE photos SET 
--   thumb_url = REPLACE(thumb_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'YOUR_NEW_HOSTNAME'),
--   small_url = REPLACE(small_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'YOUR_NEW_HOSTNAME'),
--   medium_url = REPLACE(medium_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'YOUR_NEW_HOSTNAME'),
--   large_url = REPLACE(large_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'YOUR_NEW_HOSTNAME'),
--   preview_url = REPLACE(preview_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'YOUR_NEW_HOSTNAME')
-- WHERE thumb_url LIKE '%pub-7d412c6efb5943b5bc587e695e22001e.r2.dev%';

-- ============================================================
-- EXAMPLE with real hostname (update YOUR_NEW_HOSTNAME)
-- ============================================================

-- UPDATE photos SET 
--   thumb_url = REPLACE(thumb_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'pub-abc123.r2.dev'),
--   small_url = REPLACE(small_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'pub-abc123.r2.dev'),
--   medium_url = REPLACE(medium_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'pub-abc123.r2.dev'),
--   large_url = REPLACE(large_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'pub-abc123.r2.dev'),
--   preview_url = REPLACE(preview_url, 'pub-7d412c6efb5943b5bc587e695e22001e.r2.dev', 'pub-abc123.r2.dev')
-- WHERE thumb_url LIKE '%pub-7d412c6efb5943b5bc587e695e22001e.r2.dev%';
