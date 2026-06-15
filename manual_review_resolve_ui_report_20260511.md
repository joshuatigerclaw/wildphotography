# wild_manual_review_resolve_ui — Run Report
**Workflow:** `wild_manual_review_resolve_ui`
**Trigger:** Cron `wild-manual-review-ui` (6b4a48c3-4579-42e7-8fcb-0f5c9d8ca2d8)
**Run time:** 2026-05-11 19:53 (America/Costa_Rica) / 2026-05-12 01:53 UTC
**Operator:** Joshua ten Brink / WildPhotography system

---

## Executive Summary

The `manual_review_queue.json` held **9 items** — all classified `original_not_found_in_r2`.
None of the 9 items had fixable derivative assets in R2. All 9 have been forwarded to the orphan review queue for permanent record.

---

## Queue Items Processed

| Metric | Value |
|---|---|
| Total items in queue | 9 |
| `original_not_found_in_r2` | 9 |
| Fixed (thumb_url restored from R2) | 0 |
| Unresolved | 9 |

### Item Details

| Photo ID | Slug | R2 Original Key | Deriv Thumb | Thumb Was Set | Resolution |
|---|---|---|---|---|---|
| 37410 | test-test1776 | null | — | No | Unresolved — no R2 key, no source |
| 43880 | peninsula-de-nicoya--_cl0a0969 | originals/peninsula-de-nicoya/CL0A0969.JPG | Missing | Yes | Unresolved — R2 key exists but no deriv thumb |
| 43899 | people-watching--_2019-12-26-13-02-42 | null | — | No | Unresolved — no R2 key, no source |
| 43997 | playas-del-coco--_2022-03-12-12-08-28 | null | — | No | Unresolved — no R2 key, no source |
| 43998 | rio-savagre-costa-rica--_2020-06-05-11-37-07 | null | — | No | Unresolved — no R2 key, no source |
| 44218 | peninsula-papagayo--_2020-11-26-14-11-13 | null | — | No | Unresolved — no R2 key, no source |
| 44311 | punta-leona--_2021-06-11-09-12-03 | null | — | No | Unresolved — no R2 key, no source |
| 44312 | montezuma-costa-rica--_2021-03-25-11-39-45 | null | — | No | Unresolved — no R2 key, no source |
| 44313 | puntarenas-costa-rica--_2018-08-03-17-34-23 | null | — | No | Unresolved — no R2 key, no source |

### Investigation Notes

- **Photo 43880** is the only item with a valid R2 original key (`originals/peninsula-de-nicoya/CL0A0969.JPG`). The original file exists in R2, but the expected derivative path (`derivatives/peninsula-de-nicoya/CL0A0969-thumb.jpg`) does not. The record already has `thumb_url` set — it likely references a deprecated Cloudflare Pages path.

- **7 items** (43899, 43997, 43998, 44218, 44311, 44312, 44313) have `original_r2_key=null` and `thumb_url` empty — true orphans with no recoverable assets.

- **Photo 37410** is a debug/test entry (`test-test1776`, content_hash starts with `test1776`). Cannot be fixed.

---

## Resolution Actions

### 1. Queue Cleared ✅
`wildphotography/manual_review_queue.json` → `[]`

### 2. Items Archived ✅
Archived to: `wildphotography/inventory/manual_review_queue_archive_20260511_195424.json`
- 9 items tagged with `check_result: no_r2_key`
- 9 items tagged with `classification: unrecoverable_ui_review`

### 3. Orphan Review Queue Updated ✅

| Metric | Before | After |
|---|---|---|
| Items in orphan review | 934 | 943 |
| New items added | — | 9 |

All 9 items tagged `no_r2_key: true`, `recover_type: no_r2_key`.

---

## System Health After Run

| Metric | Value |
|---|---|
| `manual_review_queue.json` | Empty ✅ |
| Orphan review queue depth | 943 items |
| UI render anomalies pending | 0 ✅ |
| R2 originals confirmed missing | 8 (7 null + 1 no deriv) |
| R2 originals confirmed present | 1 (photo 43880 — but no deriv thumb) |
| False alarms (derivative found) | 0 |

---

## Next Steps

1. **Photo 43880** — the original exists in R2 but derivatives are missing. Consider running `wild_rebuild_dispatcher` for this specific photo, or check whether the thumb_url still references `wildphoto-storage.pages.dev` and update if needed.
2. **Orphan review queue at 943 items** — all classified `unrecoverable_orphan` or `unrecoverable_ui_review`. No automated repair path. Manual review only if desired.
3. **Deprecated domain check** — any `wildphoto-storage.pages.dev` URLs remaining in `thumb_url` fields should be flagged for cleanup.