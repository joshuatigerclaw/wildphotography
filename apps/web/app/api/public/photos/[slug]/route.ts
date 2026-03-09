/**
 * Public API: GET /api/public/photos/:slug
 * 
 * Returns photo details for downstream consumers (like NaturalCostaRica)
 * Includes: title, description, keywords, derivative URLs, canonical URL, credit
 * Does NOT include: original_r2_key, original URLs
 */

import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const SITE_URL = 'https://wildphotography.com';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sql = neon(DATABASE_URL);
  
  // Get photo with keywords
  const photos = await sql(`
    SELECT p.*, 
           COALESCE(array_agg(k.name) FILTER (WHERE k.name IS NOT NULL), '{}') as keywords
    FROM photos p
    LEFT JOIN photo_keywords pk ON p.id = pk.photo_id
    LEFT JOIN keywords k ON pk.keyword_id = k.id
    WHERE p.slug = $1 AND p.is_active = true
    GROUP BY p.id
  `, [slug]);
  
  if (photos.length === 0) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }
  
  const photo = photos[0];
  
  // Build response (NO original keys or URLs)
  const response = {
    title: photo.title,
    description: photo.description,
    slug: photo.slug,
    keywords: photo.keywords?.filter(Boolean) || [],
    // Derivative URLs only
    images: {
      thumb: photo.thumb_url,
      small: photo.small_url,
      medium: photo.medium_url,
      large: photo.large_url,
      preview: photo.preview_url,
    },
    // Metadata
    location: photo.location,
    camera: photo.camera_model,
    lens: photo.lens,
    width: photo.width,
    height: photo.height,
    // Canonical URL
    canonicalUrl: `${SITE_URL}/photo/${photo.slug}`,
    // Credit/copyright
    credit: '© Joshua ten Brink / Wildphotography',
    license: 'All Rights Reserved',
  };
  
  return NextResponse.json(response);
}
