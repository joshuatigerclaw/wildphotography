/**
 * Gallery Promotion Ranking Engine — Project 19
 *
 * Scores and ranks alternate galleries for cross-gallery discovery.
 * Promotes the most valuable alternates based on:
 *
 *   score = relevance + intent + monetization + contentQuality + diversityBonus − redundancyPenalty
 *
 * Applied consistently across:
 *   - Photo page "Also in" section (top 2)
 *   - Modal discovery (top 1–2)
 *   - Gallery hover/tap reveal (top 1–2)
 *
 * Scoring model summary:
 *   A. Relevance (0–5)  — how closely the gallery matches the image subject
 *   B. Intent    (0–5)  — likelihood of driving user action / search intent
 *   C. Monetization (0–5) — affiliate / revenue potential
 *   D. Content quality (0–3) — gallery photo count
 *   E. Diversity bonus (+0–2) — reward cross-axis combinations (species ↔ location)
 *   F. Redundancy penalty (−0 to −3) — suppress near-duplicate taxonomy
 *
 * Promotion threshold: score ≥ 6 (configurable via RankOptions.minScore)
 * Display cap: top 2 by default (configurable via RankOptions.maxResults)
 */

// ============================================================
// Types
// ============================================================

export type GalleryType = 'species' | 'location' | 'region' | 'theme';

export interface RankableGallery {
  id: string;
  slug: string;
  name: string;
  /** DB column: galleries.gallery_type */
  galleryType?: string | null;
  /** Total photos in this gallery (from gallery_photos COUNT) */
  photoCount?: number | null;
  /** DB column: galleries.has_affiliate_content */
  hasAffiliateContent?: boolean | null;
}

export interface RankOptions {
  /** Maximum number of promoted galleries to return (default: 2) */
  maxResults?: number;
  /**
   * Minimum promotion score required to include a gallery (default: 6).
   * Pass 0 to bypass threshold — useful as a pre-migration fallback when
   * gallery_type / photoCount metadata is not yet available.
   */
  minScore?: number;
}

export interface ScoredGallery<T extends RankableGallery> {
  gallery: T;
  score: number;
}

// ============================================================
// Type resolution
// ============================================================

function resolveType(g: RankableGallery): GalleryType {
  const t = (g.galleryType ?? 'theme').toLowerCase();
  if (t === 'species') return 'species';
  if (t === 'location') return 'location';
  if (t === 'region') return 'region';
  return 'theme';
}

// ============================================================
// A. Relevance Score (0–5)
// How closely the gallery matches the image subject.
// ============================================================

function relevanceScore(candidateType: GalleryType): number {
  switch (candidateType) {
    case 'species':  return 5; // exact species or strong species match
    case 'location': return 4; // exact location or strong location match
    case 'region':   return 2; // regional level
    case 'theme':    return 1; // generic / catch-all
  }
}

// ============================================================
// B. Intent Score (0–5)
// How likely this gallery leads to user action or satisfies search intent.
// ============================================================

function intentScore(type: GalleryType): number {
  switch (type) {
    case 'location': return 5; // destination intent (Arenal, Carara, Monteverde)
    case 'species':  return 4; // species intent (Macaw, Toucan, Quetzal)
    case 'region':   return 3; // regional intent
    case 'theme':    return 2; // abstract / general
  }
}

// ============================================================
// C. Monetization Score (0–5)
// Affiliate / revenue potential — critical for conversion.
// ============================================================

function monetizationScore(g: RankableGallery, type: GalleryType): number {
  if (g.hasAffiliateContent && type === 'location') return 5; // strong affiliate + location tours
  if (type === 'location') return 4;                           // location — strong tour match
  if (g.hasAffiliateContent && type === 'species') return 4;  // species + wildlife tours
  if (type === 'species') return 2;                            // species — medium relevance
  if (g.hasAffiliateContent) return 2;                        // affiliate but non-location/species
  return 0;
}

// ============================================================
// D. Content Quality Score (0–3)
// Based on gallery photo count — thin galleries get suppressed.
// ============================================================

function contentQualityScore(photoCount: number): number {
  if (photoCount >= 10) return 3;
  if (photoCount >= 6)  return 2;
  if (photoCount >= 1)  return 1;
  return 0;
}

// ============================================================
// E. Diversity Bonus (+0–2)
// Reward galleries that add a new dimension to the user's journey.
// ============================================================

function diversityBonus(candidateType: GalleryType, activeType: GalleryType): number {
  if (candidateType === activeType) return 0;
  // Maximum bonus: cross-axis combination (species ↔ location)
  if (
    (activeType === 'location' && candidateType === 'species') ||
    (activeType === 'species'  && candidateType === 'location')
  ) return 2;
  return 1; // slightly different angle
}

// ============================================================
// F. Redundancy Penalty (−0 to −3)
// Penalise galleries that duplicate the active context.
// ============================================================

function redundancyPenalty(candidateType: GalleryType, activeType: GalleryType): number {
  if (candidateType === activeType) return 3; // nearly identical taxonomy
  return 0;
}

// ============================================================
// Context-aware tiebreaker weight
// When scores are equal, prefer galleries that expand the user's journey:
//   - Viewing a location → surface species next
//   - Viewing a species  → surface location next
//   - Viewing a theme    → prefer species or location over region/theme
// ============================================================

function typePreferenceWeight(type: GalleryType, activeType: GalleryType): number {
  if (activeType === 'location' && type === 'species')  return 1;
  if (activeType === 'species'  && type === 'location') return 1;
  if (activeType === 'theme' && (type === 'species' || type === 'location')) return 1;
  return 0;
}

// ============================================================
// Public API
// ============================================================

/**
 * Compute the promotion score for a single candidate gallery
 * relative to the currently active gallery.
 *
 * Exposed separately for debugging / logging purposes.
 */
export function computePromotionScore(
  candidate: RankableGallery,
  activeGallery: RankableGallery,
): number {
  const cType = resolveType(candidate);
  const aType = resolveType(activeGallery);
  const count = candidate.photoCount ?? 0;

  return (
    relevanceScore(cType) +
    intentScore(cType) +
    monetizationScore(candidate, cType) +
    contentQualityScore(count) +
    diversityBonus(cType, aType) -
    redundancyPenalty(cType, aType)
  );
}

/**
 * Rank a list of candidate galleries relative to the active gallery.
 *
 * Pipeline:
 *   1. Exclude the active gallery itself
 *   2. Suppress galleries with a known-thin photo count (< 5)
 *   3. Score each candidate
 *   4. Filter by minScore threshold
 *   5. Sort: score DESC, then context-aware type preference as tiebreaker
 *   6. Return top maxResults galleries (stripped of scores)
 *
 * Pre-migration graceful fallback:
 *   When no galleries have promotion metadata (all default to galleryType='theme',
 *   photoCount=0), pass `minScore: 0` to bypass the threshold. The input order
 *   (from DB sort_order) then determines which galleries appear.
 */
export function rankAlternateGalleries<T extends RankableGallery>(
  candidates: T[],
  activeGallery: T,
  options: RankOptions = {},
): T[] {
  const maxResults = options.maxResults ?? 2;
  const minScore   = options.minScore   ?? 6;
  const activeType = resolveType(activeGallery);

  const scored: ScoredGallery<T>[] = candidates
    // Never promote the active gallery
    .filter(g => g.id !== activeGallery.id)
    // Suppression rule: only filter by photo count when count is known (non-null)
    .filter(g => g.photoCount == null || g.photoCount >= 5)
    .map(g => ({ gallery: g, score: computePromotionScore(g, activeGallery) }))
    // Minimum score threshold
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => {
      // Primary: descending score
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreaker: context-aware type preference
      const aW = typePreferenceWeight(resolveType(a.gallery), activeType);
      const bW = typePreferenceWeight(resolveType(b.gallery), activeType);
      return bW - aW;
    });

  return scored.slice(0, maxResults).map(({ gallery }) => gallery);
}
