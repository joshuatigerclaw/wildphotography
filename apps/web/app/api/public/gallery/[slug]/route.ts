/**
 * Public API: GET /api/public/gallery/:slug
 * 
 * Get gallery with photos for downstream consumers
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

  // Get gallery
  const galleries = await sql(`
    SELECT g.id, g.name, g.slug, g.description, p.thumb_url as cover
    FROM galleries g
    LEFT JOIN photos p ON g.cover_photo_id = p.id
    WHERE g.slug = $1 AND g.is_active = true
  `, [slug]);

  if (galleries.length === 0) {
    return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
  }

  const gallery = galleries[0];

  // Get photos in gallery
  const photos = await sql(`
    SELECT p.slug, p.title, p.description, p.thumb_url, p.small_url, p.location
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    WHERE gp.gallery_id = $1 AND p.is_active = true
    ORDER BY gp.sort_order
    LIMIT 100
  `, [gallery.id]);

  const response = {
    name: gallery.name,
    slug: gallery.slug,
    description: gallery.description,
    canonicalUrl: `${SITE_URL}/gallery/${gallery.slug}`,
    cover: gallery.cover,
    photos: photos.map((p: any) => ({
      title: p.title,
      slug: p.slug,
      description: p.description,
      location: p.location,
      images: {
        thumb: p.thumb_url,
        medium: p.small_url,
      },
      canonicalUrl: `${SITE_URL}/photo/${p.slug}`,
    })),
  };

  return NextResponse.json(response);
}
