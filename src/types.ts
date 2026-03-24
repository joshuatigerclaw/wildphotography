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
 * Photo with full metadata from Neon database
 */
export interface PhotoDerivatives {
  // Core IDs
  id: number;
  slug: string;
  
  // Gallery linkage
  gallery_id?: number;
  gallery_slug?: string;
  gallery_name?: string;
  
  // Source info
  source_path?: string;
  filename?: string;
  canonical_filename?: string;
  content_hash?: string;
  
  // Public metadata
  title: string | null;
  description: string | null;
  description_long: string | null;
  keywords: string | null;
  subjects: string | null;
  scene_type: string | null;
  
  // Species
  species_common_name: string | null;
  species_scientific_name: string | null;
  species_confidence: number | null;
  animal_group: string | null;
  
  // Location
  country: string | null;
  region: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  location_hint: string | null;
  
  // EXIF
  date_taken: string | null;
  date_uploaded: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  iso: string | null;
  shutter_speed: string | null;
  aperture: string | null;
  focal_length_mm: string | null;
  width: number | null;
  height: number | null;
  
  // Legacy URL fields (for fallback)
  locationName?: string | null;
  thumb_url?: string | null;
  small_url?: string | null;
  medium_url?: string | null;
  large_url?: string | null;
  preview_url?: string | null;
  
  // Derivative keys from Neon DB
  thumb_r2_key: string | null;
  small_r2_key: string | null;
  medium_r2_key: string | null;
  large_r2_key: string | null;
  preview_r2_key: string | null;
  original_r2_key: string | null;
  
  // State
  ready_for_public_render?: boolean;
  search_ready?: boolean;
  published?: boolean;
  needs_review?: boolean;
  views_count?: number | null;
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
  parent_gallery_id?: number | null;
}

// Legacy type alias for backward compatibility
export type Photo = PhotoDerivatives;
