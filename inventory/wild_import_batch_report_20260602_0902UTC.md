# WildPhotography Import Batch Report — 2026-06-02 09:02 UTC
**Worker:** f6c6a1a4-33d1-4af5-9102-08224ab54372 (cron scheduler)
**Run time:** 2026-06-02 09:02 UTC (June 2, 2026 03:02 AM Costa Rica)
**Batch:** batch 200 — No new files

## Queue Status
| Queue | Items | Status |
|-------|------:|--------|
| fresh_import_queue | 0 | Empty |
| fresh_batch_next_5 | — | Missing (all exhausted) |
| working_batch_queue | 0 | Empty |
| working_import_queue | 100 | All completed (Jaco-Beach duplicates) |
| pending_hash_queue | 21 | All resolved |
| new_uploads_queue | 3 | Empty (dict structure) |

## SSD Scan Results
- **Costa-Rica-Gallery folders on disk:** 95
- **Currently mapped in GALLERY_MAP:** 22
- **Unmapped folders with Neon match:** 69
- **Unmapped folders without Neon match:** 5 (Tarcoles, The-Environment, Airport, Timelapse, La-Garita)

## Import Pipeline Status: CAUGHT UP — BLOCKED BY STALE GALLERY_MAP

The import worker runs every 15 minutes, connects to Neon DB, loads all existing hashes (~44,690), then checks `fresh_batch_next_5.json` which is empty/missing. Result: each run exits immediately with "no work."

**Root cause:** The GALLERY_MAP in `run_import_batch_active.py` (and `run_import_fresh.py`) only covers 22 of 95 Costa-Rica-Gallery folders. The remaining 69 folders have files on disk that are duplicates against Neon hashes — but the map is too small to even scan those folders for new content.

### Unmapped Folders with Neon Gallery Matches (69 folders, ~11,741 files)
Largest unmapped galleries that could be imported immediately with updated GALLERY_MAP:

| Folder | Files | Neon Gallery |
|--------|------:|---------------|
| Costa-Rica-Gallery/Beaches | 863 | costa-rica-gallery-beaches (id=110) |
| Costa-Rica-Gallery/Best-of-Costa-Rica | 653 | costa-rica-gallery-best-of-costa-rica (id=109) |
| Costa-Rica-Gallery/Santa-Teresa-Malpais | 586 | santa-teresa-malpais (id=91) |
| Costa-Rica-Gallery/Birds-Macaws-Lapas | 538 | costa-rica-gallery-birds-macaws-lapas (id=347) |
| Costa-Rica-Gallery/Rio-Savagre-Costa-Rica | 471 | costa-rica-gallery-rio-savagre-costa-rica (id=129) |
| Costa-Rica-Gallery/Puntarenas-Costa-Rica | 437 | costa-rica-gallery-puntarenas-costa-rica (id=346) |
| Costa-Rica-Gallery/Flowers-plants-trees | 413 | costa-rica-gallery-flowers-plants-trees (id=128) |
| Costa-Rica-Gallery/Costa-Rica | 395 | costa-rica (id=25) |
| Costa-Rica-Gallery/Playas-del-Coco | 395 | playas-del-coco (id=73) |
| Costa-Rica-Gallery/Golfo-de-Nicoya | 368 | golfo-de-nicoya (id=39) |
| Costa-Rica-Gallery/La-Sabana-Estadio-Nacional | 361 | costa-rica-gallery-la-sabana... (id=141) |
| Costa-Rica-Gallery/Wildlife | 352 | costa-rica-gallery-wildlife (id=126) |
| Costa-Rica-Gallery/Conchal-Guanacaste | 334 | conchal-guanacaste (id=24) |
| Costa-Rica-Gallery/Papagayo-Bahia-Culebra | 324 | papagayo-bahia-culebra (id=64) |
| Costa-Rica-Gallery/Escazu-Costa-Rica | 302 | escazu-costa-rica (id=32) |
| Costa-Rica-Gallery/Peninsula-de-Osa | 300 | peninsula-de-osa (id=67) |
| Costa-Rica-Gallery/Landscape | 284 | landscape (id=54) |
| Costa-Rica-Gallery/San-Jose-Costa-Rica | 283 | san-jose-costa-rica (id=88) |
| Costa-Rica-Gallery/Tamarindo-Guanacaste-Costa-Rica | 258 | costa-rica-gallery-tamarindo... (id=134) |
| Costa-Rica-Gallery/Waterfalls-in-Costa-Rica | 217 | waterfalls-in-costa-rica (id=100) |
| (47 more folders, 1,000–200 files each) | ~2,400 | various |

Note: Most files are likely duplicates. Import script skips via hash comparison before inserting — so even with an expanded GALLERY_MAP, many will be skipped as dupes. But some new content likely exists in these folders.

### Unmapped Folders with NO Neon Gallery (5 folders)
Cannot import without creating new galleries first:
- `Tarcoles-` — ~61 files, no matching Neon gallery
- `The-Environment-` — ~49 files
- `Juan-Santamaria-San-Jose-Airport-SJO-` — ~29 files
- `Timelapse-Videos` — ~24 files
- `La-Garita-de-Alajuela` — ~0 files

## One Known Read-Error File (Pending Resolution)
- `DJI_0004.JPG` in `2025 Tambor New Years/Drone Selected/Selected` — Google Drive network mount, resource deadlock. File exists (50MB) but cannot be read. Hash unknown. Affects pending_hash_queue.

## Status: NO IMPORT POSSIBLE THIS RUN

**What would unblock the pipeline:**
1. **Expand GALLERY_MAP** in `run_import_batch_active.py` and `run_import_fresh.py` to include all 69 unmapped CR folders with Neon matches. This requires human approval since it changes the import config.
2. **Create 5 new Neon galleries** for unmapped folders (Tarcoles, The-Environment, etc.) — requires human decision.
3. **Retry the one stuck file** from Google Drive once the network mount is accessible.

**What each cron run currently does:** Connects to Neon, loads ~44,690 hashes, checks for `fresh_batch_next_5.json` (missing), exits. No damage, no progress.

---
*WildPhotography Import Worker — batch 200*