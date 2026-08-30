/**
 * SEO Quality Thresholds
 *
 * Pages below these thresholds are kept for navigation but marked noindex.
 * See Phase 13 of the SEO implementation plan.
 */

export const SEO_THRESHOLDS = {
  /** Species page can be indexed when: */
  species: {
    minPhotosForIndex: 5,
    /** OR: 3+ photos PLUS meaningful editorial metadata */
    minPhotosWithEditorial: 3,
  },
  /** Location page can be indexed when: */
  location: {
    minPhotosForIndex: 8,
    /** OR: enough unique content to be independently useful */
    minPhotosWithEditorial: 5,
  },
  /** Gallery can appear in sitemap when: */
  gallery: {
    minPhotosForSitemap: 5,
  },
} as const;

/**
 * Determine if a species page should be indexed based on photo count.
 * Returns { indexable: true } if page has enough content.
 * Returns { indexable: false, reason } if page is too thin.
 */
export function speciesIndexable(
  photoCount: number,
  hasEditorialContent: boolean = false
): { indexable: boolean; reason?: string } {
  if (photoCount >= SEO_THRESHOLDS.species.minPhotosForIndex) {
    return { indexable: true };
  }
  if (
    photoCount >= SEO_THRESHOLDS.species.minPhotosWithEditorial &&
    hasEditorialContent
  ) {
    return { indexable: true };
  }
  return {
    indexable: false,
    reason: `Species page has ${photoCount} photo(s) — requires ${SEO_THRESHOLDS.species.minPhotosForIndex} for index or ${SEO_THRESHOLDS.species.minPhotosWithEditorial} with editorial content`,
  };
}

/**
 * Determine if a location page should be indexed.
 */
export function locationIndexable(
  photoCount: number,
  hasEditorialContent: boolean = false
): { indexable: boolean; reason?: string } {
  if (photoCount >= SEO_THRESHOLDS.location.minPhotosForIndex) {
    return { indexable: true };
  }
  if (
    photoCount >= SEO_THRESHOLDS.location.minPhotosWithEditorial &&
    hasEditorialContent
  ) {
    return { indexable: true };
  }
  return {
    indexable: false,
    reason: `Location page has ${photoCount} photo(s) — requires ${SEO_THRESHOLDS.location.minPhotosForIndex} for index or ${SEO_THRESHOLDS.location.minPhotosWithEditorial} with editorial content`,
  };
}

/**
 * Determine if a gallery should be in the XML sitemap.
 */
export function galleryIndexable(photoCount: number): boolean {
  return photoCount >= SEO_THRESHOLDS.gallery.minPhotosForSitemap;
}
