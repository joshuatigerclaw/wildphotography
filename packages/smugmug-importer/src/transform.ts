/**
 * Transform SmugMug data to Neon and Typesense formats
 */

import { SmugMugImage, Album } from './client';
import { normalizeKeywords, generateKeywordSlugs } from './keywords';

export interface NeonPhotoData {
  smugmug_key: string;
  title: string;
  description: string | null;
  location: string | null;
  camera_model: string | null;
  lens: string | null;
  width: number | null;
  height: number | null;
  orientation: string | null;
  date_taken: Date | null;
  date_uploaded: Date;
  date_modified: Date;
  is_active: boolean;
  popularity: number;
  original_url: string | null;
}

export interface NeonKeywordData {
  name: string;
  slug: string;
}

export interface TypesenseDocument {
  id: string;
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  gallery: string;
  gallery_slug: string;
  location: string;
  country: string;
  camera_model: string;
  lens: string;
  orientation: string;
  taken_year: number;
  taken_month: number;
  taken_timestamp: number;
  date_uploaded: number;
  popularity: number;
  width: number;
  height: number;
  thumb_url: string;
  small_url: string;
  medium_url: string;
  large_url: string;
  preview_url: string;
  status: string;
}

/**
 * Transform SmugMug image to Neon photo data
 */
export function transformToNeon(
  image: SmugMugImage,
  albumKey: string,
  albumName: string
): NeonPhotoData {
  const width = image.Width || null;
  const height = image.Height || null;
  
  // Determine orientation
  let orientation: string | null = null;
  if (width && height) {
    if (width > height) orientation = 'landscape';
    else if (width < height) orientation = 'portrait';
    else orientation = 'square';
  }
  
  // Parse dates
  const dateTaken = image.TakenDate || image.Date || image.DateCreated || null;
  const dateTakenParsed = dateTaken ? new Date(dateTaken) : null;
  
  return {
    smugmug_key: image.ImageKey,
    title: image.Caption || image.FileName || 'Untitled',
    description: image.Description || null,
    location: null, // Would need to look up album location or use metadata
    camera_model: image.MetaData?.Camera || null,
    lens: image.MetaData?.Lens || null,
    width,
    height,
    orientation,
    date_taken: dateTakenParsed,
    date_uploaded: new Date(),
    date_modified: new Date(),
    is_active: true,
    popularity: 0,
    original_url: image.OriginalImage?.Url || null,
  };
}

/**
 * Transform SmugMug keywords to normalized format
 */
export function transformKeywords(image: SmugMugImage): NeonKeywordData[] {
  const keywords = image.Keywords || [];
  const normalized = normalizeKeywords(keywords);
  
  return normalized.map(n => ({
    name: n.normalized,
    slug: n.slug,
  }));
}

/**
 * Transform to Typesense document
 */
export function transformToTypesense(
  photoId: number,
  photo: NeonPhotoData,
  keywords: string[],
  gallerySlug: string,
  galleryName: string,
  derivativeUrls: {
    thumb?: string;
    small?: string;
    medium?: string;
    large?: string;
    preview?: string;
  }
): TypesenseDocument {
  const takenTimestamp = photo.date_taken 
    ? photo.date_taken.getTime() 
    : Date.now();
  
  const takenDate = photo.date_taken 
    ? photo.date_taken 
    : new Date();
  
  return {
    id: String(photoId),
    slug: `smugmug-${photo.smugmug_key}`,
    title: photo.title,
    description: photo.description || '',
    keywords,
    gallery: galleryName,
    gallery_slug: gallerySlug,
    location: photo.location || '',
    country: photo.location?.includes('Costa Rica') ? 'Costa Rica' : '',
    camera_model: photo.camera_model || '',
    lens: photo.lens || '',
    orientation: photo.orientation || '',
    taken_year: takenDate.getFullYear(),
    taken_month: takenDate.getMonth() + 1,
    taken_timestamp: takenTimestamp,
    date_uploaded: photo.date_uploaded.getTime(),
    popularity: photo.popularity,
    width: photo.width || 0,
    height: photo.height || 0,
    thumb_url: derivativeUrls.thumb || '',
    small_url: derivativeUrls.small || '',
    medium_url: derivativeUrls.medium || '',
    large_url: derivativeUrls.large || '',
    preview_url: derivativeUrls.preview || '',
    status: 'active',
  };
}

export default {
  transformToNeon,
  transformKeywords,
  transformToTypesense,
};
