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
}

export interface Photo {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  filename: string;
  locationName: string | null;
}

export interface Gallery {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}
