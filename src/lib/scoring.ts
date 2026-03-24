/**
 * Commercial Priority Scoring for WildPhotography Pages
 * 
 * Scores galleries and photos by revenue potential to prioritize:
 * - Metadata enrichment
 * - CTA optimization
 * - Internal linking
 * - Affiliate density
 */

export interface ScoringFactors {
  // Destination strength (0-100)
  destination_score: number;
  
  // Wildlife intent (0-100)
  wildlife_score: number;
  
  // Affiliate match quality (0-100)
  affiliate_relevance_score: number;
  
  // SEO completeness (0-100)
  seo_completeness_score: number;
  
  // Metadata quality (0-100)
  metadata_quality_score: number;
  
  // Internal linking potential (0-100)
  internal_linking_score: number;
  
  // Conversion intent (0-100)
  conversion_intent_score: number;
}

// Destination commercial strength
const DESTINATION_COMMERCE: Record<string, number> = {
  'monteverde': 95,      // High tourism, birdwatching
  'arenal': 95,          // Top volcano destination
  'tortuguero': 90,      // Unique wildlife
  'corcovado': 90,       // Premium wildlife
  'manuel antonio': 85, // Beach + wildlife
  'carara': 85,         // Scarlet macaws
  'osa': 80,
  'uvita': 80,
  'costa rica': 70,
  'default': 50,
};

// Wildlife intent keywords
const WILDLIFE_KEYWORDS = [
  'bird', 'birds', 'birdwatching', 'macaw', 'toucan', 'quetzal',
  'wildlife', 'animal', 'mammal', 'monkey', 'sloth', 'jaguar',
  'reptile', 'amphibian', 'insect', 'butterfly',
  'marine', 'whale', 'dolphin', 'turtle', 'sea turtle'
];

// High-value species for affiliate
const HIGH_VALUE_SPECIES = [
  'quetzal', 'scarlet macaw', 'toucan', 'sloth', 'monkey',
  'jaguar', 'puma', 'tapir', ' toucan', 'macaw'
];

/**
 * Calculate destination score
 */
export function calcDestinationScore(
  locationName?: string, 
  region?: string, 
  gallerySlug?: string,
  country?: string
): number {
  const searchText = `${locationName || ''} ${region || ''} ${gallerySlug || ''} ${country || ''}`.toLowerCase();
  
  for (const [dest, score] of Object.entries(DESTINATION_COMMERCE)) {
    if (searchText.includes(dest)) {
      return score;
    }
  }
  
  return DESTINATION_COMMERCE['default'];
}

/**
 * Calculate wildlife intent score
 */
export function calcWildlifeScore(
  speciesCommonName?: string,
  animalGroup?: string,
  keywords?: string,
  title?: string,
  description?: string
): number {
  const searchText = `${speciesCommonName || ''} ${animalGroup || ''} ${keywords || ''} ${title || ''} ${description || ''}`.toLowerCase();
  
  let score = 20; // Base score
  
  // High-value species
  for (const species of HIGH_VALUE_SPECIES) {
    if (searchText.includes(species)) {
      score += 30;
      break;
    }
  }
  
  // Wildlife keywords
  for (const kw of WILDLIFE_KEYWORDS) {
    if (searchText.includes(kw)) {
      score += 15;
    }
  }
  
  // Animal group presence
  if (animalGroup && ['bird', 'mammal', 'reptile', 'amphibian', 'marine'].includes(animalGroup.toLowerCase())) {
    score += 20;
  }
  
  return Math.min(score, 100);
}

/**
 * Calculate affiliate relevance score
 */
export function calcAffiliateRelevanceScore(
  destinationScore: number,
  wildlifeScore: number
): number {
  // Affiliate relevance = combination of destination + wildlife
  return Math.round((destinationScore * 0.6) + (wildlifeScore * 0.4));
}

/**
 * Calculate SEO completeness score
 */
export function calcSeoCompletenessScore(
  hasTitle: boolean,
  hasDescription: boolean,
  hasKeywords: boolean,
  hasAltText: boolean
): number {
  let score = 0;
  
  if (hasTitle) score += 25;
  if (hasDescription) score += 30;
  if (hasKeywords) score += 25;
  if (hasAltText) score += 20;
  
  return score;
}

/**
 * Calculate metadata quality score
 */
export function calcMetadataQualityScore(
  hasSpecies: boolean,
  hasScientificName: boolean,
  hasLocation: boolean,
  hasGPS: boolean,
  hasEXIF: boolean,
  hasGallery: boolean
): number {
  let score = 0;
  
  if (hasSpecies) score += 25;
  if (hasScientificName) score += 15;
  if (hasLocation) score += 20;
  if (hasGPS) score += 10;
  if (hasEXIF) score += 15;
  if (hasGallery) score += 15;
  
  return score;
}

/**
 * Calculate internal linking score
 */
export function calcInternalLinkingScore(
  hasGallery: boolean,
  hasLocation: boolean,
  hasSpecies: boolean,
  photoCount: number
): number {
  let score = 0;
  
  if (hasGallery) score += 30;
  if (hasLocation) score += 30;
  if (hasSpecies) score += 25;
  if (photoCount > 10) score += 15;
  
  return Math.min(score, 100);
}

/**
 * Calculate conversion intent score
 */
export function calcConversionIntentScore(
  destinationScore: number,
  wildlifeScore: number,
  isFeatured: boolean,
  isPremium: boolean
): number {
  let score = (destinationScore + wildlifeScore) / 2;
  
  if (isFeatured) score += 15;
  if (isPremium) score += 10;
  
  return Math.min(score, 100);
}

/**
 * Calculate overall commercial priority score
 */
export function calcCommercialPriorityScore(factors: ScoringFactors): number {
  // Weighted average
  const weights = {
    destination_score: 0.20,
    wildlife_score: 0.20,
    affiliate_relevance_score: 0.20,
    seo_completeness_score: 0.15,
    metadata_quality_score: 0.10,
    internal_linking_score: 0.075,
    conversion_intent_score: 0.075,
  };
  
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (factors as any)[key] * weight;
  }
  
  return Math.round(total);
}

/**
 * Classify into tiers
 */
export function getTier(score: number): string {
  if (score >= 80) return 'Tier 1';
  if (score >= 65) return 'Tier 2';
  if (score >= 50) return 'Tier 3';
  return 'Tier 4';
}

/**
 * Get CTA intensity for tier
 */
export function getTierCTAStyle(tier: string): {
  cta_aggressive: boolean;
  intro_rich: boolean;
  internal_links_aggressive: boolean;
  affiliate_density: 'high' | 'medium' | 'low';
} {
  switch (tier) {
    case 'Tier 1':
      return {
        cta_aggressive: true,
        intro_rich: true,
        internal_links_aggressive: true,
        affiliate_density: 'high',
      };
    case 'Tier 2':
      return {
        cta_aggressive: false,
        intro_rich: true,
        internal_links_aggressive: false,
        affiliate_density: 'medium',
      };
    case 'Tier 3':
      return {
        cta_aggressive: false,
        intro_rich: false,
        internal_links_aggressive: false,
        affiliate_density: 'medium',
      };
    default:
      return {
        cta_aggressive: false,
        intro_rich: false,
        internal_links_aggressive: false,
        affiliate_density: 'low',
      };
  }
}
