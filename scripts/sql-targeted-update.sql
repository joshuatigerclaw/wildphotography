-- ============================================================
-- TARGETED SQL UPDATE FOR RESTORED PHOTOS ONLY
-- Run this AFTER verifying all derivatives are accessible
-- ============================================================
-- 
-- This updates ONLY the 64 photos that have been restored to R2
-- Does NOT touch photos with expired SmugMug keys
--
-- ============================================================

-- PREVIEW: Check which records will be updated
-- SELECT id, slug, thumb_url, large_url 
-- FROM photos 
-- WHERE id IN (44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 117, 118, 119);

-- ============================================================
-- EXECUTE: Update only the restored photo IDs
-- ============================================================

UPDATE photos SET 
  thumb_url = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/thumbs/' || id || '-thumb.jpg',
  small_url = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/smalls/' || id || '-small.jpg',
  medium_url = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/mediums/' || id || '-medium.jpg',
  large_url = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/larges/' || id || '-large.jpg',
  preview_url = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/previews/' || id || '-preview.jpg',
  derivatives_complete = true,
  ready_for_public_render = true,
  updated_at = NOW()
WHERE id IN (44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 117, 118, 119);

-- ============================================================
-- VERIFY: Check updated records
-- ============================================================

-- SELECT id, slug, large_url FROM photos WHERE id IN (44, 45, 100, 107);
