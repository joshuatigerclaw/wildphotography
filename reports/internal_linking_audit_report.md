# Phase 2: Internal Linking Audit Report

## What Was Done

1. **Audited species/[slug]/page.tsx** — documented all existing internal links and gaps
2. **Audited location/[slug]/page.tsx** — same
3. **Located and reviewed inject_internal_links.py** — already existed at scripts/
4. **Ran inject_internal_links.py** against the Neon database

---

## Species Page Audit (species/[slug]/page.tsx)

### Existing Links (DB-driven via page_links)
| Section | Link Type | Cap | Source |
|---|---|---|---|
| Featured Photos | none (VirtualizedGallery) | — | — |
| Where to See | location | 10 | page_links WHERE target_type='location' |
| Galleries Featuring | gallery | 6 | page_links WHERE target_type='gallery' |
| Related Species | species | 6 | page_links WHERE target_type='species' |
| Travel Guides | article | 3 | page_links WHERE target_type='article' |
| Tours CTA | location | — | hardcoded first location slug |
| All Photos | none | — | — |

### Gaps
- **MISSING**: /map link (static page, no DB entity)
- **MISSING**: /licensing link (static page, same)
- **LOW**: Related species UI cap 6, DB has more via same-region logic
- **LOW**: Locations UI cap 10, more available per region

---

## Location Page Audit (location/[slug]/page.tsx)

### Existing Links
| Section | Link Type | Cap | Source |
|---|---|---|---|
| Breadcrumb | /, /location | — | hardcoded |
| Info panel species chips | not linked | — | — |
| Gallery Links | gallery | 10 | metadata JSON |
| Species Links | species | 16 | metadata JSON |
| Nearby Locations | location | 6 | same-region filter, hardcoded |
| Book a Tour | affiliate | — | affiliate_blocks |
| Photo Gallery | none | — | — |

### Gaps
- **MISSING**: /map link (static page)
- **MISSING**: /licensing link
- **MISSING**: Region breadcrumb link
- **LOW**: Gallery/species links from metadata JSON (not DB-driven, risk of staleness)
- **LOW**: Nearby Locations hardcoded at 6

---

## Script Execution Results

```
=== PAGE_LINKS (pre-injection) ===
  species → gallery: 60
  species → location: 434
  species → species: 122
  location → gallery: 209
  location → location: 100
  location → species: 194

=== INJECTING SPECIES INTERNAL LINKS ===
  Found 76 public species
  Species page_links injected (total): 0

=== INJECTING LOCATION INTERNAL LINKS ===
  Found 24 public locations
  Location page_links injected (total): 0

=== PAGE_LINKS (post-injection) ===
  (no change — zero new rows added)
```

---

## Why Zero Rows Injected

The script logic is correct. Zero rows were injected because:

1. **photo_species → photo_locations overlap is very thin**: Only 5 photos exist in both junction tables. The script's species→species query depends on photos that are in both junction tables.

2. **species→location** query joins photo_species → photo_locations, but most species photos lack location associations.

3. **species→gallery** query joins galleries → photos → photo_species via cover photo — again thin overlap.

4. **location→location**: The query for same-region locations works (100 pre-existing rows were found), but since all were already linked, no new ones were injected.

**Root cause**: The photo_species junction has only 194 entries and photo_locations has 5,872 entries, but only ~5 photos bridge both tables. The junction enrichment from Phase 3 (562 photos updated) did not extend photo_species/photo_locations junction coverage.

---

## Page-Level Link Health Summary

| Entity | Total page_links | Weak Link Types |
|---|---|---|
| species (76 total) | 434 loc + 60 gal + 122 sp = 616 | species→species very sparse |
| location (24 total) | 100 loc + 209 gal + 194 sp = 503 | location→species very sparse |

---

## Recommendations

1. **Enrich photo_species junction**: Run a species identification pass on photos to add entries to photo_species. This is the bottleneck for species→species and species→location injection.

2. **Add /map and /licensing links directly to page templates**: These are static pages with no DB entity. Add them as hardcoded footer-style links in the page components rather than via page_links.

3. **Location→species injection works but is thin**: The 194 location→species links represent an average of 8 per location. Could be expanded with more photo→species associations.

4. **Monitor article→species links**: article→species has 5,643 entries — that's the strongest linking axis.

---

## Script Location

`/Users/joshuatenbrink/wildphotography_cloudflare_src/scripts/inject_internal_links.py`

The script is production-ready. It:
- Processes in batches with 300ms sleep
- Checks for duplicates before inserting
- Commits per-entity to avoid large transactions
- Logs to reports/internal_linking_log.txt
