/**
 * Media URL Generation
 * 
 * Centralized utility for generating media URLs.
 * 
 * IMPORTANT:
 * - All URLs generated here are for PUBLIC derivative assets only
 * - Originals are NEVER exposed - we store original_r2_key internally
 * - Downloads are PROTECTED (require signed URLs/auth)
 * 
 * Production: media.wildphotography.com (via Worker)
 * Development: localhost:8787 (local Worker)
 */

const config = {
  // Central configuration - update this to switch domains
  mediaBaseUrl: process.env.MEDIA_BASE_URL || 'https://wildphotography-media.josh.workers.dev',
};

/**
 * Generate media URLs for different sizes
 * 
 * @param filename - Original filename (e.g., "scarlet-macaw.jpg")
 * @returns Object with derivative URLs for each size
 * 
 * Note: preview, large are derivatives - NOT originals
 * Downloads are NOT included in public URLs
 */
export function getMediaUrls(filename: string): MediaUrls {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const ext = 'jpg';
  const base = `${config.mediaBaseUrl}/derivatives`;
  
  return {
    // Public derivatives
    thumb: `${base}/thumbs/${baseName}-thumb.${ext}`,
    small: `${base}/small/${baseName}-small.${ext}`,
    medium: `${base}/medium/${baseName}-medium.${ext}`,
    large: `${base}/large/${baseName}-large.${ext}`,
    preview: `${base}/preview/${baseName}-preview.${ext}`,
    
    // Downloads NOT exposed - protected by Worker
  };
}

/**
 * Generate original storage key (internal use only)
 * 
 * This stores the R2 key for the original file.
 * NEVER exposed through public APIs.
 * 
 * @param filename - Original filename
 * @returns R2 key for original file
 */
export function getOriginalR2Key(filename: string): string {
  return `originals/${filename}`;
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
  // downloads: string;  // NOT exposed - protected
}

export type MediaSize = 'thumb' | 'small' | 'medium' | 'large' | 'preview';

/**
 * Check if a path is a derivative (publicly accessible via Worker)
 */
export function isDerivativePath(path: string): boolean {
  return path.startsWith('derivatives/');
}

/**
 * Check if a path is an original (private - never accessible)
 */
export function isOriginalPath(path: string): boolean {
  return path.startsWith('originals/');
}

/**
 * Check if a path is a download (protected - requires auth)
 */
export function isDownloadPath(path: string): boolean {
  return path.startsWith('downloads/');
}

export default { 
  getMediaUrls, 
  getMediaUrl, 
  getOriginalR2Key,
  isDerivativePath, 
  isOriginalPath,
  isDownloadPath 
};
