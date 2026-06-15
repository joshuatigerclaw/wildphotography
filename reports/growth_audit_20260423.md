# WildPhotography Growth Audit
**Date:** Thursday, April 23rd, 2026 | 12:05 PM (America/Costa_Rica)
**Status:** HEARTBEAT_OK — Audit complete

---

## SYSTEM STATE SUMMARY

### Photo Inventory (Core Asset)
| Metric | Value |
|---|---|
| Total active photos | 34,155 |
| Ready for public render | 34,154 (100%) |
| Search ready | 34,154 (100%) |
| Metadata complete | 34,155 (100%) |
| Derivatives complete | 34,154 (100%) |
| Has SEO title | 34,155 (100%) |
| Missing thumb URL | 1 |
| Legacy static records | 14,398 |

**Media integrity is strong.** Near-total readiness and completeness across the active photo corpus. One photo missing a thumb URL needs repair.

---

## CRITICAL FINDINGS

### 🔴 PRIORITY 1 — 13,507 Orphaned Photos Not in Any Gallery

This is the single biggest discovery and revenue gap. These photos are render-ready, have proper titles, location names, and slugs, but are invisible to gallery-based navigation.

Sample orphaned photos already carry gallery-prefixed slugs (e.g., `birds-macaws-lapas-CL0A8307-2098a6`, `food--7a51c639`) — suggesting the gallery_photos join table was never populated during import, not that the photos are genuinely uncategorized.

**Impact:** These photos cannot be discovered via gallery pages, reducing page count, internal linking depth, and affiliate module impressions by an estimated 40%.

**Required action:** Run a gallery linkage repair agent that maps slug prefixes to existing gallery records and populates gallery_photos entries.

---

### 🔴 PRIORITY 2 — Only 14 Affiliate Offers in Catalog

The affiliate catalog is critically thin: 8 GetYourGuide + 6 Viator = 14 total offers. For a site with 428 published articles and 34,000+ photos, this is a massive monetization gap.

922 contextual affiliate placement blocks exist in articles, but they can only serve offers that exist in the catalog. EPC potential is being left on the table across every location guide and species page.

**Required action:** Bulk-import GetYourGuide and Viator destination/tour catalogs for Costa Rica. Target: minimum 200 active offers covering key locations (Guanacaste, Puntarenas, Arenal, Puerto Viejo, Montezuma, Tamarindo, Dominical).

---

### 🟡 PRIORITY 3 — 942 Photo Index Drift in Typesense

1,033 photos are search-ready but not in Typesense. 91 photos are in Typesense but flagged as not search-ready. Net drift of 942 photos means search results are incomplete and potentially include stale entries.

**Required action:** Run wild_typesense_reconcile_no_llm immediately to close the drift. This is a known threshold-triggered workflow.

---

### 🟡 PRIORITY 4 — Pin Queue Starved (0 Pending Items)

Pinterest queue: 134 total, 76 published, 4 deferred, **0 pending**. The queue is empty — no new pins are waiting to be published. This means the Pinterest traffic channel is idle between syndication runs and not maintaining a consistent publishing cadence.

The social syndication cron runs every 6 hours, but the queue itself needs active generation.

**Required action:** Run wild_pinterest_generation workflow to populate the queue. Daily target should be 10-20 pins, with a minimum 100-item queue buffer.

---

### 🟡 PRIORITY 5 — SEO Rank Tracking Not Populated

seo_rank_tracking and seo_query_metrics_daily tables are empty. No GSC data is flowing in. Without this, there's no visibility into which pages are ranking, which keywords drive traffic, and where SEO effort should be concentrated.

**Required action:** Verify GSC pull cron is functioning. The wild_gsc_pull_performance cron exists but may not be executing successfully.

---

## GROWTH OPPORTUNITY RANKING

### Tier 1 — High Impact, Low-Medium Risk
1. **Fix orphaned photo gallery linkage** — ~13,500 photos can be made discoverable by backfilling gallery_photos entries from slug prefix mapping. Highest ROI action available.
2. **Bulk affiliate catalog expansion** — Adding 200+ GetYourGuide/Viator offers to Costa Rica locations would enable contextual monetization across all existing articles.
3. **Close Typesense index drift** — Purely a search quality fix; low risk, moderate impact on organic discovery.

### Tier 2 — Medium Impact, Medium Effort
4. **Restore Pinterest queue generation** — The distribution channel is running dry. Refill and maintain a 100+ item queue buffer.
5. **Republish 4 deferred Pinterest pins** — These have specific issues that should be resolved and re-queued.
6. **Fix 1 missing thumb URL** — Trivial repair, one photo.

### Tier 3 — Maintenance / Monitoring
7. **Populate GSC rank tracking** — Without this, SEO optimization is blind. Diagnose why wild_gsc_pull_performance isn't populating seo_query_metrics_daily.
8. **Review 14,398 legacy static records** — These are valid display records but may need derivative/metadata auditing to ensure quality.

---

## CONTENT INVENTORY

### Page Coverage
| Page Type | Total | Published/Active | Photos Linked |
|---|---|---|---|
| Galleries | 151 (89 active) | 89 | 20,770 gallery_photos entries |
| Species pages | 76 | 76 | 195 |
| Location pages | 24 | 24 | 5,872 |
| Region pages | 7 | 7 | 0 direct |
| Articles | 429 | 428 published, 1 draft | N/A |

All 76 species and 24 locations with photo inventory have published pages — good topical coverage.

### Article Type Breakdown
| Type | Count |
|---|---|
| location_guide | 203 |
| species_guide | 122 |
| photography_guide | 40 |
| cluster | 39 |
| location | 6 |
| theme_roundup | 5 |
| Other (species, region, seasonal, lifestyle) | 14 |

The article corpus is well-structured. 325 location + species guides is solid topical authority coverage.

---

## QUICK WINS

1. Run slug-prefix-to-gallery mapper to backfill gallery_photos for the 13,507 orphaned render-ready photos
2. Import GetYourGuide Costa Rica catalog (8 → 200+ offers)
3. Trigger Typesense reconciliation for 942 drift
4. Run Pinterest generation workflow to refill queue to 100+ pending items
5. Investigate GSC cron failure

---

## BOTTOM LINE

WildPhotography's core media integrity is excellent — 34K photos, near-100% render ready and search ready. The system is well-structured. The three biggest growth levers right now are:

1. **Making 13,500 orphaned photos discoverable** via gallery linkage (40% more content surface)
2. **Expanding the affiliate catalog** from 14 to 200+ offers (revenue per page multiplier)
3. **Closing the 942-photo search index gap** (organic discovery)

These three actions together would have the highest compound impact on traffic and revenue. Pinterest queue refill and GSC monitoring are important maintenance but secondary to the three above.
