/**
 * Worker types
 */

export interface Env {
  PHOTO_BUCKET: R2Bucket;
  SMUGMUG_METADATA: Queue;
  SMUGMUG_DOWNLOAD: Queue;
  TYPESENSE_INDEX: Queue;
  SITE_URL: string;
  MEDIA_BASE_URL: string;
  NEON_TOKEN: string;
}

/**
 * Photo with full derivative key information from Neon
 */
export interface PhotoDerivatives {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  // Derivative keys from Neon DB (source of truth)
  thumb_r2_key: string | null;
  small_r2_key: string | null;
  medium_r2_key: string | null;
  large_r2_key: string | null;
  preview_r2_key: string | null;
  original_r2_key: string | null; // Private - never expose
  // Legacy URLs (for fallback)
  locationName: string | null;
}

/**
 * Gallery with cover photo info
 */
export interface Gallery {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  cover_photo_id?: number;
  photo_count?: number;
}

// Legacy type alias for backward compatibility
export type Photo = PhotoDerivatives;
