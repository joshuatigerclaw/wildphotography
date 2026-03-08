/**
 * Media URL Generation
 * 
 * Centralized utility for generating media URLs.
 * This can be updated to point to the final production domain.
 * 
 * PRODUCTION: media.wildphotography.com (via Worker)
 * DEVELOPMENT: localhost:8787 (local Worker)
 */

const config = {
  // Production: Use Worker-based delivery
  // This will be: https://media.wildphotography.com
  baseUrl: process.env.MEDIA_BASE_URL || 'https://wildphotography-media.josh.workers.dev',
  
  // Fallback for direct R2 access (if Worker not available)
  fallbackBaseUrl: 'https://wildphoto-storage.r2.cloudflarestorage.com',
};

/**
 * Generate media URLs for different sizes
 * All URLs use derivative paths only - originals are never exposed
 */
export function getMediaUrls(filename: string): MediaUrls {
  // Extract base name without extension
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const ext = filename.split('.').pop() || 'jpg';
  
  return {
    thumb: `${config.baseUrl}/derivatives/thumbs/${baseName}-thumb.${ext}`,
    small: `${config.baseUrl}/derivatives/small/${baseName}-small.${ext}`,
    medium: `${config.baseUrl}/derivatives/medium/${baseName}-medium.${ext}`,
    large: `${config.baseUrl}/derivatives/large/${baseName}-large.${ext}`,
    preview: `${config.baseUrl}/derivatives/preview/${baseName}-preview.${ext}`,
    download: `${config.baseUrl}/downloads/${baseName}-download.${ext}`,
  };
}

/**
 * Generate a specific size URL
 */
export function getMediaUrl(filename: string, size: MediaSize): string {
  const urls = getMediaUrls(filename);
  return urls[size];
}

export interface MediaUrls {
  thumb: string;
  small: string;
  medium: string;
  large: string;
  preview: string;
  download: string;
}

export type MediaSize = 'thumb' | 'small' | 'medium' | 'large' | 'preview' | 'download';

/**
 * Check if a path is a derivative (publicly accessible)
 */
export function isDerivativePath(path: string): boolean {
  return path.startsWith('derivatives/') || path.startsWith('downloads/');
}

/**
 * Check if a path is an original (private)
 */
export function isOriginalPath(path: string): boolean {
  return path.startsWith('originals/');
}

export default { getMediaUrls, getMediaUrl, isDerivativePath, isOriginalPath };
