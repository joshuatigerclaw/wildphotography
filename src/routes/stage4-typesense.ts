/**
 * SmugMug Import Pipeline - Stage 4: Typesense Indexing
 * 
 * Indexes search_ready photos into Typesense
 * Uses bulk import with action=upsert for idempotency
 */

import { neon } from '@neondatabase/serverless';
import type { Env } from '../types';

const TYPESENSE_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_PORT = 443;
const TYPESENSE_ADMIN_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';

interface TypesensePhoto {
  id: string;
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  thumb_url: string;
  small_url: string;
  medium_url: string;
  large_url: string;
  width: number;
  height: number;
  camera_model: string;
}

async function fetchSearchReadyPhotos(env: Env): Promise<TypesensePhoto[]> {
  const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
  
  const photos = await sql`
    SELECT id, slug, title, description_long, keywords, thumb_url, small_url, medium_url, large_url, width, height, camera_model
    FROM photos 
    WHERE search_ready = true
    LIMIT 100
  `;
  
  return photos.map(p => ({
    id: String(p.id),
    slug: p.slug,
    title: p.title || '',
    description: p.description_long || '',
    keywords: p.keywords ? p.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
    thumb_url: p.thumb_url || '',
    small_url: p.small_url || '',
    medium_url: p.medium_url || '',
    large_url: p.large_url || '',
    width: p.width || 0,
    height: p.height || 0,
    camera_model: p.camera_model || '',
  }));
}

async function indexToTypesense(photos: TypesensePhoto[]): Promise<{ indexed: number; errors: string[] }> {
  if (photos.length === 0) {
    return { indexed: 0, errors: [] };
  }
  
  const url = `https://${TYPESENSE_HOST}:${TYPESENSE_PORT}/collections/photos/documents/import?action=upsert`;
  
  const documents = photos.map(p => ({
    ...p,
    keywords: p.keywords.join(','),
  }));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TYPESENSE-API-KEY': TYPESENSE_ADMIN_KEY,
    },
    body: documents.map(d => JSON.stringify(d)).join('\n'),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Typesense error: ${response.status} - ${error}`);
  }
  
  const results = await response.text();
  const lines = results.split('\n').filter(Boolean);
  
  let indexed = 0;
  const errors: string[] = [];
  
  for (const line of lines) {
    const result = JSON.parse(line);
    if (result.success) {
      indexed++;
    } else {
      errors.push(JSON.stringify(result.error));
    }
  }
  
  return { indexed, errors };
}

export async function handleTypesenseIndex(
  body: { photoId?: string; slug?: string },
  env: Env
): Promise<{ success: boolean; indexed?: number; error?: string }> {
  console.log(`[typesense-index] Processing:`, body);
  
  try {
    const sql = neon(env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
    
    if (body.photoId) {
      // Single photo indexing
      const photos = await sql`
        SELECT id, slug, title, description_long, keywords, thumb_url, small_url, medium_url, large_url, width, height, camera_model
        FROM photos 
        WHERE id = ${body.photoId} AND search_ready = true
      `;
      
      if (photos.length === 0) {
        return { success: false, error: 'Photo not found or not search_ready' };
      }
      
      const p = photos[0];
      const photo: TypesensePhoto = {
        id: String(p.id),
        slug: p.slug,
        title: p.title || '',
        description: p.description_long || '',
        keywords: p.keywords ? p.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
        thumb_url: p.thumb_url || '',
        small_url: p.small_url || '',
        medium_url: p.medium_url || '',
        large_url: p.large_url || '',
        width: p.width || 0,
        height: p.height || 0,
        camera_model: p.camera_model || '',
      };
      
      const result = await indexToTypesense([photo]);
      return { success: result.errors.length === 0, indexed: result.indexed, error: result.errors[0] };
    }
    
    // Bulk indexing - all search_ready photos
    const photos = await fetchSearchReadyPhotos(env);
    const result = await indexToTypesense(photos);
    
    console.log(`[typesense-index] Indexed ${result.indexed} photos, ${result.errors.length} errors`);
    
    return { 
      success: result.errors.length === 0, 
      indexed: result.indexed,
      error: result.errors.length > 0 ? result.errors[0] : undefined
    };
    
  } catch (error: any) {
    console.error('[typesense-index] Error:', error.message);
    return { success: false, error: error.message };
  }
}
