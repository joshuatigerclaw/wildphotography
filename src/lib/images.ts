/**
 * Image utilities - handles all URL formats
 */

function getUrl(value: any): string | null {
  if (!value) return null;
  const str = String(value);
  if (str.startsWith('http')) return str;
  if (str.includes('.r2.dev')) return str;
  return null;
}

export function keyToUrl(key: string | null): string | null {
  return getUrl(key);
}

export type ImageResult = { type: 'url'; url: string } | { type: 'placeholder' };

export function renderPlaceholder(text: string = 'No image'): string {
  return `<div class="image-placeholder" style="width:100%;height:220px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">${text}</div>`;
}

function getFirstUrl(photo: any, fields: string[]): string | null {
  for (const field of fields) {
    const url = getUrl(photo[field]);
    if (url) return url;
  }
  return null;
}

export function getHomepageCardImage(photo: any): ImageResult {
  const url = getFirstUrl(photo, ['small_url', 'thumb_url', 'medium_url', 'large_url', 'r2_web_small_key', 'r2_thumb_key', 'r2_web_large_key']);
  return url ? { type: 'url', url } : { type: 'placeholder' };
}

export function getSearchCardImage(photo: any): ImageResult {
  return getHomepageCardImage(photo);
}

export function getGalleryTileImage(photo: any): ImageResult {
  return getHomepageCardImage(photo);
}

export function getGalleryCoverImage(photo: any): ImageResult {
  const url = getFirstUrl(photo, ['medium_url', 'r2_web_large_key', 'small_url']);
  return url ? { type: 'url', url } : getHomepageCardImage(photo);
}

export function getPhotoPageMainImage(photo: any): ImageResult {
  // For photo detail page, prefer large -> medium -> small
  const url = getFirstUrl(photo, ['large_url', 'medium_url', 'small_url', 'r2_web_large_key', 'r2_web_small_key']);
  return url ? { type: 'url', url } : { type: 'placeholder' };
}

export function getDisplayTitle(photo: any): string {
  return photo.title || photo.gallery_name || photo.slug || 'Untitled';
}
