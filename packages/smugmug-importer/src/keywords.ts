/**
 * Keyword Normalization Utility
 * 
 * Normalizes keywords for consistent storage and search.
 */

export interface NormalizedKeyword {
  original: string;
  normalized: string;
  slug: string;
}

/**
 * Normalize a single keyword
 */
export function normalizeKeyword(keyword: string): NormalizedKeyword {
  const original = keyword.trim();
  const normalized = original.toLowerCase().trim();
  const slug = slugify(normalized);
  
  return {
    original,
    normalized,
    slug,
  };
}

/**
 * Normalize multiple keywords
 */
export function normalizeKeywords(keywords: string[] | string | undefined | null): NormalizedKeyword[] {
  // Handle array or comma-separated string or empty
  if (!keywords) return [];
  
  let keywordList: string[];
  if (Array.isArray(keywords)) {
    keywordList = keywords;
  } else if (typeof keywords === 'string') {
    keywordList = keywords.split(',');
  } else {
    return [];
  }
  
  // Normalize each
  const normalized = keywordList
    .map((k: string) => normalizeKeyword(k))
    .filter((k: NormalizedKeyword) => k.normalized.length > 0);
  
  // Deduplicate by normalized value
  const seen = new Set<string>();
  const unique: NormalizedKeyword[] = [];
  
  for (const keyword of normalized) {
    if (!seen.has(keyword.normalized)) {
      seen.add(keyword.normalized);
      unique.push(keyword);
    }
  }
  
  return unique;
}

/**
 * Convert keyword to slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/-+/g, '-')      // Replace multiple - with single -
    .trim();
}

/**
 * Generate keyword slugs for Typesense
 */
export function generateKeywordSlugs(keywords: string[] | string | undefined | null): string[] {
  const normalized = normalizeKeywords(keywords);
  return normalized.map((k: NormalizedKeyword) => k.slug);
}

export default {
  normalizeKeyword,
  normalizeKeywords,
  generateKeywordSlugs,
};
