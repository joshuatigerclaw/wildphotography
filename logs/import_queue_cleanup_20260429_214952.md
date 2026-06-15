# wild_import_queue_cleanup Report
**Run:** 2026-04-29 21:49 (America/Costa_Rica)
**Workflow:** wild_import_queue_cleanup

## Summary

| Metric | Count |
|--------|-------|
| Total items loaded | 1286 |
| Hash collisions removed | 14 |
| Unique after dedup | 1211 |
| Already in library (duplicate) | 1211 |
| Gallery-unresolved | 0 |
| **Pending-hash (need compute)** | **61** |
| **Actionable new** | **0** |

## Key Findings

All 1211 hash-resolved items in the queue already exist in the library.
Zero new imports are actionable — every photo has already been imported.

61 items have `pending` or missing content hashes and need hash computation
before they can be evaluated. These are in `pending_hash_queue.json`.

## Output Files

- `working_batch_queue.json` → 0 actionable items (empty)
- `duplicate_skipped_queue.json` → 1211 duplicates archived
- `pending_hash_queue.json` → 61 items awaiting hash computation
- `queue_manual_review.json` → 0 gallery-unresolved items

## Source Files Scanned

- fresh_import_queue.json
- batch_new_folders_queue.json
- batch_new_discovery_queue.json
- new_uploads_queue.json
- working_import_queue.json
- import_batch_active.json
- batch_next_import.json
- working_batch_queue.json

## Conclusion

The import queue is clean. All hash-known items are already processed.
Next step: run hash computation on `pending_hash_queue.json` to determine
if the 61 pending items contain any new material.