# wild_import_queue_cleanup Report
**Run:** 2026-04-28 14:41:23 (America/Costa_Rica)
**Workflow:** wild_import_queue_cleanup

## Summary

| Metric | Count |
|--------|-------|
| Total items loaded | 8741 |
| Hash collisions removed (same hash, different queue entry) | 5602 |
| Unique after dedup | 3139 |
| Already in library (confirmed duplicate) | 3139 |
| Missing content hash (unresolved) | 0 |
| **Actionable new** | **0** |

## Interpretation

All 3,139 unique items across the 6 target queue files have content hashes already present in the Neon photos table — meaning every pending entry was a duplicate of an already-imported photo. This is a healthy state: the import pipeline has been working and the backlog is cleared.

No new source folders remain to process in the targeted queue files.

## Output Files

| File | Count | Purpose |
|------|-------|---------|
| `working_batch_queue.json` | 0 | No actionable items remain |
| `duplicate_skipped_queue.json` | 3139 | All were already imported |
| `queue_manual_review.json` | 0 | No items missing content_hash |

## Per-File Breakdown

| Queue File | Items Loaded | Notes |
|-----------|-------------|-------|
| `working_batch_queue.json` | 0 | Already cleaned in prior run |
| `birds_import_queue.json` | 563 | All confirmed duplicate |
| `batch_clean_import_queue.json` | 2602 | All confirmed duplicate |
| `batch_Tamb_Limo_Jaco_Sunr_Peni_import_queue.json` | 4570 | All confirmed duplicate |
| `batch_new_folders_queue.json` | 1000 | All confirmed duplicate |
| `batch_Bajo_La-G_Time_Cost_Play_import_queue.json` | 6 | All confirmed duplicate |

## Next Actions

- The import backlog from these 6 files is **fully cleared** — no new imports pending from these sources
- `fresh_import_queue.json` (21 items from Google Drive / 2025 Tambor New Years) and `import_batch_20260427_2305.json` (26 items) were not in the target files but should be checked for genuinely new content
- If new photos arrive from the ADATA SC740 or Google Drive, rebuild a fresh queue from source folders rather than relying on these stale queue files

