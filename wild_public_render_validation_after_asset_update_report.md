# WildPhotography Public Render Validation
**Workflow:** wild_public_render_validation_after_asset_update
**Run:** 2026-04-23 03:17 UTC (Joshua's Mac mini)

---

## Summary

| Metric | Value |
|---|---|
| Total photos | 34,331 |
| Active photos | 33,906 |
| Healthy (images_cdn) | 32,520 (94.8%) |
| Broken URLs | 1,791 |
| Validation | **FAIL** |
| Pass rate | 94.8% |

---

## CDN Status

| CDN | Status | Photos | Rate |
|---|---|---|---|
| images.wildphotography.com | OPERATIONAL | 32,520 | 100% sampled |
| wildphoto-storage.r2.cloudflarestorage.com | UNREACHABLE (SSL failure) | 1,671 | 0% |
| pub.wildphotography.com | DNS_NXDOMAIN | 20 | 0% |

**images.wildphotography.com** — the primary Cloudflare CDN — is fully operational. All sampled thumbnails returned HTTP 200. This CDN serves the overwhelming majority of photos correctly.

**wildphoto-storage.r2.cloudflarestorage.com** — the R2 bucket domain — is completely inaccessible from this environment due to an SSL handshake failure. All 1,671 photos using this URL pattern are broken. Notably, all these photos have valid `original_r2_key` values, meaning the source originals are intact and re-derivatization is possible.

**pub.wildphotography.com** — the old SmugMug-era domain — no longer resolves (DNS failure). All 20 affected photos are in Flamingo Beach and Peninsula Papagayo galleries. They also have valid original source files and can be re-processed.

---

## Broken URL Breakdown

### r2.cloudflarestorage.com (1,671 photos)

| Gallery | Photos | Priority |
|---|---|---|
| birds | 613 | High |
| sunrise-sunset | 304 | High |
| birds-macaws-lapas | 256 | High |
| jaco-beach | 220 | High |
| costa-rica-gallery-beaches | 199 | High |
| peninsula-de-osa | 65 | Medium |
| landmarks | 9 | Low |
| tambor-photos | 5 | Low |

All 1,671 have valid `original_r2_key`. The fix is to re-run derivative generation (thumb + small + medium + large + preview), then update `thumb_url` in the DB to the images.wildphotography.com CDN pattern.

### pub.wildphotography.com (20 photos)

| Gallery | Photos |
|---|---|
| costa-rica-gallery-flamingo-beach | 10 |
| costa-rica-gallery-peninsula-papagayo | 10 |

Same remediation — re-derivatize from original R2 keys and update CDN URLs.

### NULL thumb_url (120 photos)

These have no thumbnail URL at all. They need to be queued for derivative generation.

---

## Page-Level Checks

- **Homepage**: Partially broken — 12 r2.dev URLs returned HTTP 500 in prior run (that count is now 0 in DB, but r2_bucket URLs affect homepage grid)
- **Gallery Index**: PASS — covers on images_cdn
- **Gallery Detail (birds-macaws-lapas)**: PARTIAL — 256 photos on broken r2_bucket, 275 on healthy CDN
- **Photo Detail (toucan)**: PASS
- **Search Results**: PASS
- **Species Detail (quetzal)**: PASS
- **Region Pages**: PASS

---

## Actions Required

1. **Priority 1 — Re-derivatize 1,671 r2_bucket photos**: Run bulk derivative rebuild for the top 6 galleries (birds, sunrise-sunset, birds-macaws-lapas, jaco-beach, costa-rica-gallery-beaches, peninsula-de-osa). Update thumb_url to images_cdn pattern after regeneration.

2. **Priority 2 — Re-derivatize 20 pub_wildphoto photos**: Small batch for Flamingo Beach and Peninsula Papagayo galleries.

3. **Priority 3 — Generate derivatives for 120 NULL thumb_url photos**: Standard queue processing.

---

## Recommendation

The asset URL migration is substantially complete. 94.8% of photos are healthy on the working images.wildphotography.com CDN. The remaining 1,791 broken records are all recoverable — every one has valid original source files in R2. A single bulk repair batch targeting the 8 galleries with broken URLs should bring validation to approximately 99.9%.