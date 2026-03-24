# WildPhotography AGENTS.md

## Project Overview

WildPhotography.com is a wildlife photography platform and monorepo. It serves public photo galleries, species pages, region pages, and articles backed by a Neon Postgres database, Cloudflare R2 object storage, and a Typesense search index. Photos are imported from SmugMug and external drives, enriched with metadata and AI vision labels, have image derivatives generated, and are then indexed for public display.

Stack:
- **Frontend**: Next.js (`apps/web`) deployed on Vercel
- **API**: REST API server (`apps/api`)
- **Ingest**: Background job worker (`apps/ingest`)
- **Database**: Neon Postgres (Drizzle ORM) — tables: `photos`, `galleries`, `species_pages`, `region_pages`, `articles`
- **Object Storage**: Cloudflare R2 — 5 derivative sizes per photo
- **Search**: Typesense — collections: `photos`, `species_pages`, `region_pages`, `articles`
- **Agents**: Lobster workflows in `/workspace/lobster/`

---

## Global Rules

These rules apply to every agent, every workflow, and every ad-hoc task in this project. No exceptions.

- Never trust `derivatives_complete`, `ready_for_public_render`, or `search_ready` without verification.
- Never mark a photo render-ready unless a valid public thumb URL returns HTTP 200.
- Never mark a photo search-ready unless:
  - `metadata_complete = true`
  - `ready_for_public_render = true`
  - `thumb_url` is valid and canonical
  - `status != archived`
- Never write raw Cloudflare storage endpoints to public-facing image URLs.
- Canonical public media URLs must use one approved base only.
- Never create duplicate galleries when an existing slug already exists.
- Never index incomplete or broken records.
- Never guess file names or object paths during repair.
- Use Neon canonical keys and stored hashes as the source of truth.
- If source files are missing, downgrade readiness flags rather than leaving false-positive public state.
- Every repair action must be idempotent.
- Every batch run must emit a summary with exact counts.

---

## Shared Environment

### Media & Derivatives

| Derivative | Purpose |
|---|---|
| `thumb` | Public gallery thumbnails and search cards |
| `small` | Mobile-optimised display |
| `medium` | Standard detail view |
| `large` | Full-resolution display |
| `search` | Typesense visual search |

All derivative keys are stored in Neon. R2 object paths must be derived from Neon-stored keys — never constructed by guessing.

### Database Rules

- Provider: **Neon Postgres**, schema `public`
- Source of truth for photo status, readiness flags, derivative keys, and slugs
- Never update `ready_for_public_render = true` or `search_ready = true` without first confirming the derivative URLs return HTTP 200
- Never run schema migrations autonomously

### Readiness Pipeline

```
import → metadata_complete → derivatives_complete → ready_for_public_render → search_ready
```

Each flag must be earned individually. Skipping steps creates false-positive public state.

### Safety — Never Autonomous

The following actions require explicit human approval:
- Schema migrations
- Domain / canonical host changes
- Affiliate ID changes
- Bulk destructive deletes

---

## Master Operating Model

Agents must execute in this order. Do **not** let the indexer or page builder run ahead of the validator.

| Step | Agent | Purpose |
|---|---|---|
| 1 | `wild_truth_validator` | Validate reality — downgrade false-positive flags |
| 2 | `wild_url_normalizer` | Normalize all public URLs to one canonical base |
| 3 | `wild_derivative_repair_agent` | Repair broken/missing derivatives from repair queue |
| 4 | `wild_seo_enricher_v2` | Enrich weak or generic metadata for SEO quality |
| 5 | `wild_typesense_reconcile_agent` | Align Typesense with valid public-ready records only |
| 6 | `wild_gallery_optimizer_v2` | Audit gallery covers, naming, and intro text |
| 7 | `wild_ui_optimizer` | Audit UI and produce implementation tickets |
| 8 | `wild_cluster_page_builder` | Build species/location/region/article SEO pages |
| 9 | `wild_supervisor_v2` | Ongoing — dispatch what's needed based on live metrics |

---

## Automation Schedule

| Frequency | Command |
|---|---|
| Every 10 min | `wild_supervisor_v2` monitoring cycle |
| Every 30 min | `wild_truth_validator` incremental scan |
| Every 60 min | `wild_typesense_reconcile_agent` incremental reconcile |
| Every 2 hours | `wild_seo_enricher_v2` for new/weak records |
| Twice daily | `wild_gallery_optimizer_v2` incremental audit |
| Daily | `wild_cluster_page_builder` next 10 priority pages |
| Daily | `wild_production_validation_v2` full report |
| Daily (8am CR) | `wild_pinterest_agent` generate + schedule + post 20 pins |

---

## Agents

All agent workflow files live in `/workspace/lobster/`. Refer to the individual `.lobster.yaml` files for full step definitions.

### v2 Agent Pack — Integrity, SEO & UI

> These are the primary autonomous agents. Run in the order defined in the Master Operating Model above.

| Agent | File | Purpose |
|---|---|---|
| `wild_truth_validator` | `wild_truth_validator.lobster.yaml` | HEAD-check thumb URLs, verify canonical domain, downgrade false-positive flags, produce repair queue |
| `wild_url_normalizer` | `wild_url_normalizer.lobster.yaml` | Rewrite all public image URLs to `MEDIA_BASE`; reject raw R2, legacy, and malformed URLs |
| `wild_derivative_repair_agent` | `wild_derivative_repair_agent.lobster.yaml` | Regenerate derivatives from best available source, upload to R2, write canonical keys, validate HTTP 200 before setting render-ready (batch 250) |
| `wild_seo_enricher_v2` | `wild_seo_enricher_v2.lobster.yaml` | Replace weak/generic metadata with search-intent titles, descriptions, and keyword sets (batch 300) |
| `wild_typesense_reconcile_agent` | `wild_typesense_reconcile_agent.lobster.yaml` | Remove stale docs, add missing eligible docs, re-upsert changed docs, detect duplicate slugs (up to 50k) |
| `wild_gallery_optimizer_v2` | `wild_gallery_optimizer_v2.lobster.yaml` | Assign valid covers, detect duplicate gallery names, flag test galleries, generate intro text (batch 200) |
| `wild_ui_optimizer` | `wild_ui_optimizer.lobster.yaml` | Audit homepage/gallery/photo/search pages; generate implementation tickets for title, breadcrumb, affiliate, mobile, schema fixes |
| `wild_cluster_page_builder` | `wild_cluster_page_builder.lobster.yaml` | Build species/location/region/article cluster pages from valid photo inventory (up to 25/run) |
| `wild_supervisor_v2` | `wild_supervisor_v2.lobster.yaml` | Load live system metrics; conditionally dispatch v2 agents; emit concise health summary with exact counts |

### Import & Ingestion

| Agent | File | Purpose |
|---|---|---|
| `wild_import_batch` | `wild_import_batch.lobster.yaml` | Batch import photos from SmugMug or local source (100 photos, 5 folders per run) |
| `wild_external_drive_preflight_import` | `wild_external_drive_preflight_import.lobster.yaml` | Pre-flight checks before importing from external drive |
| `wild_import_queue_cleanup` | `wild_import_queue_cleanup.lobster.yaml` | Clear stale or failed import queue entries |

### Metadata & Enrichment

| Agent | File | Purpose |
|---|---|---|
| `wild_metadata_enrich` | `wild_metadata_enrich.lobster.yaml` | Enrich photo metadata from the `metadata_enrichment_pending` queue (200/run) |
| `wild_metadata_quality_enrichment` | `wild_metadata_quality_enrichment.lobster.yaml` | Quality pass over enriched metadata |
| `wild_classify_legacy_static` | `wild_classify_legacy_static.lobster.yaml` | Classify legacy static photos |
| `wild_missing_source_classification` | `wild_missing_source_classification.lobster.yaml` | Classify photos with missing source files |

### Derivatives

| Agent | File | Purpose |
|---|---|---|
| `wild_derivative_regeneration_batch` | `wild_derivative_regeneration_batch.lobster.yaml` | Regenerate image derivatives with watermark (100/run) |
| `wild_derivative_flag_correction` | `wild_derivative_flag_correction.lobster.yaml` | Fix incorrect `derivatives_complete` flags |
| `wild_derivative_reality_audit` | `wild_derivative_reality_audit.lobster.yaml` | Audit actual R2 derivative existence vs DB flags |
| `wild_rebuild_from_r2_originals` | `wild_rebuild_from_r2_originals.lobster.yaml` | Rebuild derivatives from R2 originals |
| `wild_rebuild_dispatcher` | `wild_rebuild_dispatcher.lobster.yaml` | Dispatch derivative rebuild jobs |
| `wild_derivative_autoscale_launcher` | `wild_derivative_autoscale_launcher.lobster.yaml` | Launch autoscale derivative workers |
| `wild_derivative_autoscale_controller` | `wild_derivative_autoscale_controller.lobster.yaml` | Control autoscale derivative worker count |
| `wild_derivative_autoscale_dashboard` | `wild_derivative_autoscale_dashboard.lobster.yaml` | Dashboard for autoscale status |
| `wild_derivative_rebuild_dashboard` | `wild_derivative_rebuild_dashboard.lobster.yaml` | Dashboard for rebuild progress |

### Validation & QA

| Agent | File | Purpose |
|---|---|---|
| `wild_image_qa` | `wild_image_qa.lobster.yaml` | QA checks on public visual items (500/run) |
| `wild_render_validation_after_derivative_rebuild` | `wild_render_validation_after_derivative_rebuild.lobster.yaml` | HTTP 200 validation of public render URLs after rebuild |
| `wild_search_card_thumbnail_audit` | `wild_search_card_thumbnail_audit.lobster.yaml` | Audit search card thumbnail validity |
| `wild_search_ui_card_audit` | `wild_search_ui_card_audit.lobster.yaml` | Audit search UI cards end-to-end |
| `wild_growth_audit` | `wild_growth_audit.lobster.yaml` | Platform growth and health audit |

### Search & Indexing

| Agent | File | Purpose |
|---|---|---|
| `wild_typesense_reconcile` | `wild_typesense_reconcile.lobster.yaml` | Reconcile Typesense index against Neon (up to 50k records) |
| `wild_reindex_after_derivative_rebuild` | `wild_reindex_after_derivative_rebuild.lobster.yaml` | Re-index records after derivative rebuild completes |

### Galleries & Content

| Agent | File | Purpose |
|---|---|---|
| `wild_gallery_cover_assignment` | `wild_gallery_cover_assignment.lobster.yaml` | Assign cover photos to galleries missing one (200/run) |
| `wild_article_generator` | `lobster/workflows/wild_article_generation.lobster.yaml` | Generate SEO articles at scale from validated photo inventory (10/run) |
| `wild_article_generate` | `wild_article_generate.lobster.yaml` | Generate SEO articles (legacy) |
| `wild_seo_optimize_pages` | `wild_seo_optimize_pages.lobster.yaml` | Optimise SEO for species/region/gallery pages |
| `wild_internal_linking` | `wild_internal_linking.lobster.yaml` | Add internal links across content pages |
| `wild_ui_build_pages` | `wild_ui_build_pages.lobster.yaml` | Build UI pages |
| `wild_regions_page_debug` | `wild_regions_page_debug.lobster.yaml` | Debug region page issues |

---

## Agent: wild_article_generator

**Purpose:**
Generate SEO-focused article pages at scale from validated WildPhotography photo inventory. Targets real search phrases, uses render-ready photos, builds internal links, and produces affiliate-ready HTML output.

**Prompt:** `prompts/wild_article_generator.md`
**Templates:** `prompts/wild_article_templates.md`
**Link Rules:** `prompts/wild_internal_linking_rules.md`
**Queue:** `runtime/article_queue.json`
**Outputs:** `runtime/article_outputs/`

**Must:**
- Use only render-ready images (`ready_for_public_render = true`, confirmed HTTP 200)
- Include at least 5 valid internal links per article (verified against live `link_targets`)
- Generate high-quality meta fields (title 50–60 chars, description 140–160 chars)
- Add FAQ (3–5 questions) and JSON-LD Article schema to every article
- Use affiliate blocks only for travel-intent article types
- Avoid duplicate search intent across articles
- Reject thin, generic, or duplicative output via quality gate
- Maintain premium, readable, Costa Rica-aware copy throughout

**Must Not:**
- Fabricate facts about fees, schedules, wildlife certainty, or access rules
- Reference broken or unvalidated photo URLs
- Create articles with fewer than 6 render-ready photos (for image-supported types)
- Publish articles with missing internal links or failed metadata quality checks
- Keyword stuff or produce obvious AI-pattern repetition

**Article Types:**
- `location_guide` — destination travel and wildlife guides
- `species_guide` — individual species where-to-see-and-photograph pages
- `theme_roundup` — best-of lists by topic, region, or theme
- `photography_guide` — technique and location guides for photographers

**Output:**
HTML-ready article sections (`intro_html`, `body_html`, `faq_html`, `affiliate_block_html`) plus structured metadata, internal link references, selected photo IDs, gallery/species/location slugs, and JSON-LD schema — inserted as drafts into the `articles` table.

**Quality Gate:**
Rejects publication if:
- Photo support is weak (< min_photo_count)
- Internal links are missing or unverified
- Metadata quality is poor
- Article is thin or substantially duplicative
- Word count falls below type minimum

**Dispatch Examples:**

```bash
# Run next 10 from priority queue
openclaw run --session isolated "Dispatch wild_article_generator for WildPhotography. Build the next 10 priority SEO articles from runtime/article_queue.json using validated photo inventory."

# Location articles only
openclaw run --session isolated "Dispatch wild_article_generator for 10 Costa Rica location guide articles. Use strongest validated photo inventory. 900–1400 words, internally linked, affiliate-ready."

# Species articles only
openclaw run --session isolated "Dispatch wild_article_generator for species guide articles using validated wildlife photo inventory only."
```

**Post-Generation (automatic):**
1. Internal link validation
2. JSON-LD schema validation
3. Sitemap update
4. Indexing eligibility check
5. Pinterest pin title/description preparation

---

## Agent: wild_pinterest_agent

**Purpose:**
Generate and publish Pinterest pins daily for WildPhotography, driving traffic from Pinterest into SEO article pages, location pages, species pages, and gallery pages. Targets real search phrases, uses render-ready photos, produces keyword-rich copy, assigns pins to themed boards, and schedules posting within the 8am–5pm Costa Rica time window.

**Workflow:** `lobster/workflows/wild_pinterest_generation.lobster.yaml`
**Generator Prompt:** `prompts/wild_pinterest_generator.md`
**Board Rules:** `prompts/wild_pinterest_board_rules.md`
**Queue:** `runtime/pinterest_queue.json`
**Pinterest Account:** `NaturalCostaRica`

**Daily Output:**
- 10–30 pins per day
- 3–5 pin variations per page (different images + different titles)
- 3 pin styles: `overlay`, `minimal`, `collage`
- Pins spread evenly across 8am–5pm, 20–40 minutes apart

**Page Priority (descending):**
1. Articles (SEO-driven, highest affiliate conversion)
2. Location pages
3. Species pages
4. Gallery pages

**Pin Styles:**
| Style | Use Case |
|---|---|
| `overlay` | Bold text on image — "Best of" and location titles, high CTR |
| `minimal` | Photography-forward, no or subtle text — branding and saves |
| `collage` | 3–5 related images — works for roundups and location guides |

**Boards:**

| Board | Trigger |
|---|---|
| `Costa Rica Beaches` | Beach / coast / playa content |
| `Costa Rica Wildlife` | Species pages, wildlife articles |
| `Costa Rica Photography` | Galleries, photography guides |
| `Arenal Volcano Costa Rica` | Arenal / La Fortuna content |
| `Manuel Antonio Costa Rica` | Manuel Antonio content |
| `Monteverde Costa Rica` | Monteverde / cloud forest content |
| `Guanacaste Costa Rica` | Guanacaste region content |
| `Tortuguero Costa Rica` | Tortuguero / sea turtle content |
| `Osa Peninsula Costa Rica` | Osa / Corcovado content |
| `Best Beaches in Costa Rica` | Beach roundup articles |
| `Costa Rica Travel Guide` | General travel articles |
| `Wildlife in Costa Rica` | Wildlife watching articles |
| `Tropical Destinations` | Broad destination content |
| `Costa Rica Travel` | Default fallback |

**Must:**
- Use only render-ready images (`ready_for_public_render = true`, confirmed HTTP 200)
- Generate unique `pin_title` and `image_url` per variation (no same-day duplicates)
- Target a specific destination URL (never the homepage)
- Include the primary keyword naturally in both title and description
- Assign pins to the correct board per `wild_pinterest_board_rules.md`
- Schedule pins evenly — never bulk-post
- Increment `pinterest_pinned_count` and `last_pinned_at` on success

**Must Not:**
- Link to wildphotography.com homepage
- Post broken or unvalidated image URLs
- Duplicate titles or images within the same run
- Post outside the 8am–5pm Costa Rica time window
- Fabricate locations, species names, or travel facts
- Use more than 2 hashtags per pin
- Keyword-stuff descriptions

**Article → Pinterest Trigger:**
When `wild_article_generator` publishes a new article, it automatically queues 3–5 pin variations for that article via `wild_pinterest_agent`. No manual dispatch required.

**Dispatch Examples:**

```bash
# Run full daily Pinterest cycle (generate + schedule + post)
openclaw run --session isolated "Dispatch wild_pinterest_agent for WildPhotography. Generate 20 Pinterest pins from latest SEO articles, location pages, and species pages. Use 3 styles. Schedule 8am–5pm. Post all."

# Generate pins only (no posting)
openclaw run --session isolated "Dispatch wild_pinterest_agent for WildPhotography. Generate 20 pins only — do not post. Write to runtime/pinterest_queue.json."

# Pins for a specific page type only
openclaw run --session isolated "Dispatch wild_pinterest_agent for WildPhotography. Generate Pinterest pins for species pages only. Target wildlife boards."

# Fill board gap — target a specific board
openclaw run --session isolated "Dispatch wild_pinterest_agent for WildPhotography. Generate 10 pins for the Costa Rica Beaches board using beach location pages and best-of articles."
```

**Post-Pin Actions (automatic):**
1. Update `pinterest_pinned_count` on the source page
2. Set `last_pinned_at` timestamp
3. Mark queue entries as `posted`
4. Log failed pins with reason

### Repair & Recovery

| Agent | File | Purpose |
|---|---|---|
| `wild_repair_incomplete_legacy` | `wild_repair_incomplete_legacy.lobster.yaml` | Repair incomplete legacy photo records |
|`wild_legacy_orphan_review` | `wild_legacy_orphan_review.lobster.yaml` | Review orphaned legacy records |
| `wild_orphan_closure` | `wild_orphan_closure.lobster.yaml` | Close out confirmed orphan records |

### Manual Review

| Agent | File | Purpose |
|---|---|---|
| `wild_manual_review_resolve_metadata` | `wild_manual_review_resolve_metadata.lobster.yaml` | Human-in-the-loop metadata resolution |
| `wild_manual_review_resolve_ui` | `wild_manual_review_resolve_ui.lobster.yaml` | Human-in-the-loop UI issue resolution |
| `wild_manual_review_resolve_content_quality` | `wild_manual_review_resolve_content_quality.lobster.yaml` | Human-in-the-loop content quality resolution |

### Monetization & Social

| Agent | File | Purpose |
|---|---|---|
| `wild_affiliate_placement` | `wild_affiliate_placement.lobster.yaml` | Affiliate link placement |
| `wild_social_syndication` | `wild_social_syndication.lobster.yaml` | Social media content syndication |
| `wild_pinterest_agent` | `lobster/workflows/wild_pinterest_generation.lobster.yaml` | Generate, schedule, and post 10–30 Pinterest pins daily from validated photo inventory and published SEO pages |

### Orchestration

| Agent | File | Purpose |
|---|---|---|
| `wild_supervisor_dispatch` | `wild_supervisor_dispatch.lobster.yaml` | Top-level supervisor: evaluates system metrics and dispatches agents |
