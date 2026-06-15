# WildPhotography Import Batch Report — 2026-06-03 10:10 UTC
**Worker:** f6c6a1a4-33d1-4af5-9102-08224ab54372 (cron scheduler)
**Run time:** 2026-06-03 10:10 UTC (June 3, 2026 04:05 AM Costa Rica)
**Batch:** BLOCKED — Pipeline stall

## Pipeline Status

| Queue | Status |
|-------|--------|
| fresh_batch_next_5 | MISSING (deleted after exhaustion) |
| fresh_import_queue | EMPTY (2 bytes) |
| working_batch_queue | EMPTY (107 bytes) |
| pending_hash_queue | 21 items, all resolved (20 completed, 1 skipped) |
| new_uploads_queue | 3 items |

## Root Cause: GALLERY_MAP Too Small

- **Folders on ADATA SC740:** 95
- **Mapped in GALLERY_MAP:** 22
- **Unmapped (no import path):** 94
- **Unmapped files (not indexed):** ~10320

The `scan_for_new_photos.py` script can only build queues for folders in GALLERY_MAP.
With 73 unmapped folders, the scanner finds zero new files and produces an empty batch.
The empty batch file is deleted after processing, leaving `fresh_batch_next_5.json` missing.
The next cron run finds no queue, no work, exits immediately.

## Unmapped Folders With Largest File Counts

| Folder | Files |
|--------|------:|
| Birds | 680 |
| Tambor-Nicoya-Peninsula-Costa-Rica | 598 |
| Limon-Puerto-Viejo-Cocles-Playa-Chiquita-y-Punta-Uva | 462 |
| Jaco-Beach | 447 |
| Sunrise-Sunset | 425 |
| Beaches | 424 |
| Food- | 386 |
| Peninsula-Papagayo | 353 |
| Isla-Tortuga | 339 |
| Best-of-Costa-Rica | 333 |
| Costa-Rica | 273 |
| Punta-Leona | 273 |
| Birds-Macaws-Lapas | 263 |
| Montezuma-Costa-Rica | 231 |
| Flowers-plants-trees | 224 |
| Wildlife | 211 |
| Santa-Teresa-Malpais | 205 |
| Puntarenas-Costa-Rica | 200 |
| Playas-del-Coco | 196 |
| La-Sabana-Estadio-Nacional-Costa-Rica-San-Jose | 172 |

## 1 Known Stalled File (Google Drive Mount)

- `DJI_0004.JPG` at `2025 Tambor New Years/Drone Selected/Selected/`
- Size: 50MB
- Error: `Errno 11 Resource deadlock avoided` — mount is live but file read blocks
- **Not blocking pipeline** — isolated to pending_hash_queue, excluded from normal flow

## Status: NO IMPORT POSSIBLE — HUMAN ACTION REQUIRED

The import pipeline cannot self-heal. The GALLERY_MAP in three scripts needs expansion:
1. `run_import_batch_active.py` — GALLERY_MAP with 22 entries
2. `run_import_fresh.py` — GALLERY_MAP with ~19 entries  
3. `scan_for_new_photos.py` — GALLERY_MAP with ~28 entries

To unblock: update GALLERY_MAP in all three files to include all unmapped folders.
Each unmapped folder must be verified against Neon galleries table to get the correct
(gallery_id, slug) tuple before adding to the map.

**This is a configuration change requiring human approval, not an automated fix.**

---
*WildPhotography Import Worker — batch 201 — blocked*
