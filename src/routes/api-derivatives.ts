/**
 * Plan-Based Derivative Access Control
 * WildPhotography API Platform — Phase 5
 * 
 * Only returns derivative URLs allowed by the customer's plan.
 * NEVER exposes original URLs, R2 keys, or protected assets.
 */

export interface PhotoRecord {
  id: number;
  slug: string;
  title: string | null;
  description: string | null;
  description_long: string | null;
  keywords: string[] | null;
  species_common_name: string | null;
  scientific_name: string | null;
  location_name: string | null;
  region: string | null;
  country: string | null;
  gallery_slug: string | null;
  gallery_name: string | null;
  latitude: number | null;
  longitude: number | null;
  public_safe_geo: boolean | null;
  width: number | null;
  height: number | null;
  orientation: string | null;
  photographer: string | null;
  thumb_url: string | null;
  small_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  preview_url: string | null;
  original_r2_key: string | null;  // NEVER exposed
  og_image_url: string | null;
  date_taken: string | null;
  // Internal links metadata
  content_tags?: string[] | null;
}

/**
 * Filter derivative URLs based on plan permissions.
 * Always excludes original_r2_key and internal R2 paths.
 */
export function getAllowedDerivativesForPlan(
  photo: PhotoRecord,
  allowedSizes: string[]
): {
  thumb_url: string | null;
  small_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  preview_url: string | null;
  attribution_text: string;
  license_summary: string;
} {
  const derivatives: Record<string, string | null> = {
    thumb: photo.thumb_url,
    small: photo.small_url,
    medium: photo.medium_url,
    large: photo.large_url,
    preview: photo.preview_url,
  };

  // Build result with only allowed sizes
  const result: Record<string, string | null> = {
    thumb_url: null,
    small_url: null,
    medium_url: null,
    large_url: null,
    preview_url: null,
  };

  for (const size of allowedSizes) {
    if (derivatives[size]) {
      result[`${size}_url`] = derivatives[size];
    }
  }

  // Attribution text
  const photographer = photo.photographer || 'Joshua ten Brink';
  const attributionText = `© ${photographer} / WildPhotography.com`;

  // License summary based on what's exposed
  const hasLarge = result.large_url !== null;
  const licenseSummary = hasLarge
    ? 'Commercial license available via WildPhotography.com'
    : 'Standard license available via WildPhotography.com';

  return {
    thumb_url: result.thumb_url,
    small_url: result.small_url,
    medium_url: result.medium_url,
    large_url: result.large_url,
    preview_url: result.preview_url,
    attribution_text: attributionText,
    license_summary: licenseSummary,
  };
}

/**
 * Build content_helper object for each photo response
 */
export function buildContentHelper(photo: PhotoRecord): {
  keywords: string[];
  suggested_alt_text: string;
  suggested_caption: string;
  seo_topics: string[];
  social_caption_seed: string;
  article_prompt_seed: string;
  destination_context: string | null;
  wildlife_context: string | null;
} {
  // Gather keywords from photo.keywords and species/location
  const keywords: string[] = [];
  if (photo.keywords && Array.isArray(photo.keywords)) {
    keywords.push(...photo.keywords);
  }
  if (photo.species_common_name) keywords.push(photo.species_common_name);
  if (photo.location_name) keywords.push(photo.location_name + ', Costa Rica');
  if (photo.region) keywords.push(photo.region);
  if (photo.scientific_name) keywords.push(photo.scientific_name);

  // Deduplicate
  const uniqueKeywords = [...new Set(keywords)].slice(0, 20);

  // Suggested alt text
  let altText = photo.title || '';
  if (!altText && photo.species_common_name) {
    altText = photo.species_common_name;
    if (photo.location_name) altText += ` in ${photo.location_name}`;
    altText += ', Costa Rica';
  }
  if (!altText) altText = 'WildPhotography image from Costa Rica';

  // Suggested caption
  const captionParts: string[] = [];
  if (photo.species_common_name) captionParts.push(photo.species_common_name);
  if (photo.scientific_name) captionParts.push(`(${photo.scientific_name})`);
  if (photo.location_name) captionParts.push(` photographed in ${photo.location_name}`);
  captionParts.push('| © Joshua ten Brink / WildPhotography.com');
  const caption = captionParts.join(' ');

  // SEO topics
  const seoTopics: string[] = [];
  if (photo.species_common_name) {
    seoTopics.push(`Wildlife in Costa Rica`, `${photo.species_common_name} Costa Rica`);
  }
  if (photo.location_name) {
    seoTopics.push(`Travel to ${photo.location_name}`, `Photography in ${photo.location_name}`);
  }
  if (photo.region) seoTopics.push(`Costa Rica ${photo.region} travel`);

  // Social caption seed
  let socialCaption = '';
  if (photo.species_common_name) {
    socialCaption = `${photo.species_common_name}`;
    if (photo.location_name) socialCaption += ` spotted in ${photo.location_name}, Costa Rica`;
    socialCaption += '. ';
  }
  if (photo.description) {
    socialCaption += photo.description.slice(0, 100) + (photo.description.length > 100 ? '...' : '');
  }

  // Article prompt seed
  let articlePrompt = 'Write a travel article about ';
  if (photo.species_common_name) {
    articlePrompt += `observing ${photo.species_common_name} in Costa Rica`;
  } else if (photo.location_name) {
    articlePrompt += `wildlife photography in ${photo.location_name}`;
  } else {
    articlePrompt += 'Costa Rica wildlife and travel photography';
  }

  // Destination context
  const destinationContext = photo.location_name
    ? `The photo was taken in ${photo.location_name}${photo.region ? `, ${photo.region}` : ''}, Costa Rica`
    : null;

  // Wildlife context
  const wildlifeContext = photo.species_common_name
    ? `The photo features a ${photo.species_common_name}${photo.scientific_name ? ` (${photo.scientific_name})` : ''}`
    : null;

  return {
    keywords: uniqueKeywords,
    suggested_alt_text: altText,
    suggested_caption: caption,
    seo_topics: seoTopics.slice(0, 5),
    social_caption_seed: socialCaption || altText,
    article_prompt_seed: articlePrompt,
    destination_context: destinationContext,
    wildlife_context: wildlifeContext,
  };
}

/**
 * Build API response photo object — only exposes plan-allowed derivatives
 */
export function buildApiPhotoResponse(
  photo: PhotoRecord,
  allowedSizes: string[],
  attributionRequired: boolean,
  includeContentHelper: boolean = true
): Record<string, any> {
  const derivatives = getAllowedDerivativesForPlan(photo, allowedSizes);
  const contentHelper = includeContentHelper ? buildContentHelper(photo) : undefined;

  const response: Record<string, any> = {
    id: photo.id,
    slug: photo.slug,
    title: photo.title || '',
    description: photo.description || photo.description_long || null,
    keywords: photo.keywords || [],
    // Species info
    species: photo.species_common_name || null,
    scientific_name: photo.scientific_name || null,
    // Location info
    location_name: photo.location_name || null,
    region: photo.region || null,
    country: photo.country || 'Costa Rica',
    // Only expose lat/lon if public_safe_geo is true
    latitude: photo.public_safe_geo ? photo.latitude : null,
    longitude: photo.public_safe_geo ? photo.longitude : null,
    // Gallery info
    gallery_slug: photo.gallery_slug || null,
    gallery_name: photo.gallery_name || null,
    // Derivatives (plan-restricted)
    ...derivatives,
    // Canonical
    canonical_url: `https://wildphotography.com/photo/${photo.slug}`,
    // Image metadata
    width: photo.width,
    height: photo.height,
    orientation: photo.orientation || (photo.width && photo.height ? (photo.width > photo.height ? 'landscape' : 'portrait') : null),
    date_taken: photo.date_taken || null,
  };

  if (attributionRequired) {
    response.attribution_text = derivatives.attribution_text;
  }

  response.license_summary = derivatives.license_summary;

  if (contentHelper) {
    response.content_helper = contentHelper;
  }

  return response;
}