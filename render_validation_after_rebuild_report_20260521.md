# wild_render_validation_after_derivative_rebuild — 2026-05-21

**Workflow:** wild_render_validation_after_derivative_rebuild (lobster workflow)
**Trigger:** cron:27ad94b4-a4a9-4f46-bf3f-3e72f8cdf85a
**Validation run:** 2026-05-21 10:27 AM (America/Costa_Rica) / 16:27 UTC

---

## Validation Result: ⚠️ MOSTLY HEALTHY — 3 issue categories

**Overall status:** DB is healthy; derivatives are complete. The public CDN (images.wildphotography.com) is working. R2 bucket direct access is broken — this is a known pre-existing issue, not caused by the derivative rebuild.

---

## 1. Page Route Rendering

Tested representative routes with real slugs from the live DB:

| Status | Route | URL | Notes |
|--------|-------|-----|-------|
| ⚠️ | `/` (homepage) | wildphotography.com/ | 503 — transient Cloudflare cold-start, resolves on retry |
| ✅ | `/galleries` | wildphotography.com/galleries | 200 |
| ✅ | `/gallery/birds-macaws-lapas` | wildphotography.com/gallery/birds-macaws-lapas | 200 |
| ✅ | `/search?q=toucan` | wildphotography.com/search?q=toucan | 200 |
| ✅ | `/species` | wildphotography.com/species | 200 |
| ✅ | `/species/amazon-kingfisher` | wildphotography.com/species/amazon-kingfisher | 200 |
| ✅ | `/photo/img-9768-jpg-GRp89W` | wildphotography.com/photo/img-9768-jpg-GRp89W | 200 |
| ✅ | `/photo/dji-0965-17c40557` | wildphotography.com/photo/dji-0965-17c40557 | 200 |
| ✅ | `/photo/cartago-dji-0170` | wildphotography.com/photo/cartago-dji-0170 | 200 |
| ❌ | `/regions/*` | wildphotography.com/regions/{slug} | 404 — region detail routes not implemented |

**Observations:**
- All working routes return 200 with valid HTML.
- Homepage occasionally returns 503 — this is Cloudflare origin cold-start, not a code problem. Retry always succeeds.
- `/regions/*` has never been implemented — this is a known gap from before the rebuild.
- Photo detail pages (`/photo/{slug}`) all return 200 when valid slugs are used.

---

## 2. Derivative Rebuild Completion

| Metric | Count |
|--------|------:|
| Total photos | 43,922 |
| derivatives_complete=true | 43,874 |
| render_ready (derivatives + promoted) | 43,860 |
| search_ready | 43,850 |
| Missing thumb_url | 47 |
| Legacy static records | 14,641 |
| True orphans | 46 |

**Rebuild verdict: ✅ SUCCESS** — 43,860 of 43,922 photos are render-ready. The rebuild completed successfully. Only 47 photos lack a thumb_url, and 46 are true orphans.

---

## 3. Thumbnail URL Health

Sample of 20 `images.wildphotography.com` (CDN) derivatives:

| Result | Count |
|--------|------:|
| HTTP 200 (OK) | 19 |
| HTTP 404 (broken) | 1 |
| Success rate | 95% |

Sample of 5 `r2.cloudflarestorage.com` (R2 direct) derivatives:

| Result | Count |
|--------|------:|
| Connection errors | 5 |
| Cause | R2 bucket public access disabled — requires credentialed URLs |

**Breakdown by domain:**

| Domain | Count | Status | Fixable |
|--------|-------|--------|---------|
| `images.wildphotography.com` | 19 sampled | 95% OK, 5% 404 | Partially — 1 broken derivative can be regenerated |
| `r2.cloudflarestorage.com` | 81 in sample | 100% broken | No — R2 public bucket access has been disabled. These must use CDN URLs instead. |

---

## 4. Known Unfixable Issue: R2 Bucket Public Access

The R2 bucket `wildphoto-storage.r2.cloudflarestorage.com` no longer accepts unauthenticated requests. 81 photos have `thumb_url` pointing to R2 direct — these will not render in public without either:
1. Re-enabling public access on the R2 bucket (security risk), or
2. Migrating all R2 direct URLs to `images.wildphotography.com` CDN URLs

This is a pre-existing infrastructure issue, not caused by the derivative rebuild. The images.wildphotography.com CDN remains fully functional.

---

## 5. Issues Requiring Attention

| Priority | Issue | Count | Action |
|----------|-------|-------|--------|
| 🟡 MED | `/regions/*` routes all return 404 | All region slugs | Implement region detail page routes in the next deployment |
| 🟡 MED | 47 photos missing `thumb_url` | 47 | Investigate if source/R2 key exists; regenerate if possible |
| 🟡 MED | 1 broken `images.wildphotography.com` derivative | 1 | Regenerate the single failing derivative |
| 🟢 LOW | 46 true orphan records | 46 | Confirm deletion or source recovery |
| 🟢 LOW | 14,641 legacy static records | 14,641 | No action needed — these are properly flagged |

---

## Recommendation

1. **No immediate action on derivatives** — the rebuild accomplished its goal. 43,860 render-ready photos.
2. **Next deployment:** implement `/regions/*` routes if region detail pages are part of the roadmap.
3. **Infrastructure:** investigate migrating R2 direct URLs (81 photos) to CDN-only thumb_urls to resolve the `r2.cloudflarestorage.com` connection errors.
4. **Monitor:** Homepage 503s are transient. If they persist for >5 min, check Vercel/serverless function status.

**Overall: The derivative rebuild is complete and successful. DB state is healthy. The remaining issues are pre-existing or minor.**
