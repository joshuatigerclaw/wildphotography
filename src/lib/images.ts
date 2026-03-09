/**
 * Image Selection Helper
 * 
 * Implements strict derivative selection rules:
 * - Uses DB derivative keys as source of truth
 * - Never reconstructs filenames from slug/title
 * - Proper fallback and placeholder handling
 * - No exposure of originals/downloads
 */

import type { PhotoDerivatives } from '../types';

// R2 public base URL
const R2_PUBLIC_BASE = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

/**
 * Convert a derivative key to a public URL
 * @param key - The R2 key from DB (e.g., 'derivatives/thumbs/img_9761-thumb.jpg')
 * @returns Public URL or null if key is empty
 */
export function keyToUrl(key: string | null): string | null {
  if (!key || key.trim() === '') return null;
  
  // Ensure key has derivatives/ prefix
  const fullKey = key.startsWith('derivatives/') ? key : `derivatives/${key}`;
  
  return R2_PUBLIC_BASE + '/' + fullKey;
}

/**
 * Image selection result - either a valid URL or placeholder state
 */
export type ImageResult = 
  | { type: 'url'; url: string }
  | { type: 'placeholder' };

/**
 * Placeholder HTML for when no derivative exists
 */
export function renderPlaceholder(text: string = 'No image'): string {
  return `<div class="image-placeholder" style="width:100%;height:220px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">${text}</div>`;
}

/**
 * Get image for homepage featured photo cards
 * Priority: thumb → small → medium → preview → large → placeholder
 */
export function getHomepageCardImage(photo: PhotoDerivatives): ImageResult {
  if (photo.thumb_r2_key) {
    const url = keyToUrl(photo.thumb_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.small_r2_key) {
    const url = keyToUrl(photo.small_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.medium_r2_key) {
    const url = keyToUrl(photo.medium_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.preview_r2_key) {
    const url = keyToUrl(photo.preview_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.large_r2_key) {
    const url = keyToUrl(photo.large_r2_key);
    if (url) return { type: 'url', url };
  }
  return { type: 'placeholder' };
}

/**
 * Get image for gallery tiles/listing cards
 * Priority: thumb → small → medium → preview → large → placeholder
 */
export function getGalleryTileImage(photo: PhotoDerivatives): ImageResult {
  // Same as homepage card - prioritize small/lightweight
  return getHomepageCardImage(photo);
}

/**
 * Get image for photo detail page main display
 * Priority: large → preview → medium → small → thumb → placeholder
 */
export function getPhotoPageMainImage(photo: PhotoDerivatives): ImageResult {
  if (photo.large_r2_key) {
    const url = keyToUrl(photo.large_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.preview_r2_key) {
    const url = keyToUrl(photo.preview_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.medium_r2_key) {
    const url = keyToUrl(photo.medium_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.small_r2_key) {
    const url = keyToUrl(photo.small_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.thumb_r2_key) {
    const url = keyToUrl(photo.thumb_r2_key);
    if (url) return { type: 'url', url };
  }
  return { type: 'placeholder' };
}

/**
 * Get image for search result cards
 * Priority: thumb → small → medium → preview → large → placeholder
 */
export function getSearchCardImage(photo: PhotoDerivatives): ImageResult {
  return getHomepageCardImage(photo);
}

/**
 * Get image for gallery cover
 * Priority: small → medium → preview → large → thumb → placeholder
 */
export function getGalleryCoverImage(photo: PhotoDerivatives): ImageResult {
  if (photo.small_r2_key) {
    const url = keyToUrl(photo.small_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.medium_r2_key) {
    const url = keyToUrl(photo.medium_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.preview_r2_key) {
    const url = keyToUrl(photo.preview_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.large_r2_key) {
    const url = keyToUrl(photo.large_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.thumb_r2_key) {
    const url = keyToUrl(photo.thumb_r2_key);
    if (url) return { type: 'url', url };
  }
  return { type: 'placeholder' };
}

/**
 * Get hero/featured image
 * Priority: medium → preview → large → small → placeholder
 */
export function getHeroImage(photo: PhotoDerivatives): ImageResult {
  if (photo.medium_r2_key) {
    const url = keyToUrl(photo.medium_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.preview_r2_key) {
    const url = keyToUrl(photo.preview_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.large_r2_key) {
    const url = keyToUrl(photo.large_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.small_r2_key) {
    const url = keyToUrl(photo.small_r2_key);
    if (url) return { type: 'url', url };
  }
  return { type: 'placeholder' };
}

/**
 * Get image for photo page lightbox/fullscreen view
 * Priority: large → preview → medium → placeholder
 */
export function getPhotoPageLightboxImage(photo: PhotoDerivatives): ImageResult {
  if (photo.large_r2_key) {
    const url = keyToUrl(photo.large_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.preview_r2_key) {
    const url = keyToUrl(photo.preview_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.medium_r2_key) {
    const url = keyToUrl(photo.medium_r2_key);
    if (url) return { type: 'url', url };
  }
  return { type: 'placeholder' };
}

/**
 * Get image for related photo strip on photo page
 * Priority: thumb → small → medium → placeholder
 */
export function getRelatedStripImage(photo: PhotoDerivatives): ImageResult {
  if (photo.thumb_r2_key) {
    const url = keyToUrl(photo.thumb_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.small_r2_key) {
    const url = keyToUrl(photo.small_r2_key);
    if (url) return { type: 'url', url };
  }
  if (photo.medium_r2_key) {
    const url = keyToUrl(photo.medium_r2_key);
    if (url) return { type: 'url', url };
  }
  return { type: 'placeholder' };
}

/**
 * Clean title for display
 * Priority: meaningful title → cleaned filename → description-derived → fallback
 */
export function getDisplayTitle(photo: PhotoDerivatives): string {
  // If title exists and is not a raw camera filename
  if (photo.title && photo.title.length > 0) {
    // Check if it's a meaningful title (not like IMG_9761.JPG)
    const isCameraFile = /^IMG_|^DSC_|^PXL_|^RAW_/i.test(photo.title);
    if (!isCameraFile) {
      // Clean up extension
      return photo.title.replace(/\.(jpg|jpeg|png|tiff?|webp)$/i, '');
    }
  }
  
  // Try to use first 5 words of description
  if (photo.description && photo.description.length > 0) {
    const words = photo.description.split(/\s+/).slice(0, 5).join(' ');
    if (words.length > 3) {
      return words;
    }
  }
  
  // Fallback to slug-based title
  return photo.slug.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}
