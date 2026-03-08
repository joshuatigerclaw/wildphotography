/**
 * Public API: GET /api/public/tag/:keywordSlug
 * 
 * Get photos by keyword/tag for downstream consumers
 */

import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const SITE_URL = 'https://wildphotography.com';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keywordSlug: string }> }
) {
  const { keywordSlug } = await params;
  const sql = neon(DATABASE_URL);

  // Find keyword
  const keywords = await sql(
    'SELECT id, name FROM keywords WHERE slug = $1',
    [keywordSlug]
  );

  if (keywords.length === 0) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
  }

  const keyword = keywords[0];

  // Get photos with this keyword
  const photos = await sql(`
    SELECT p.id, p.slug, p.title, p.description, 
           p.thumb_url, p.small_url, p.medium_url, p.location
    FROM photos p
    JOIN photo_keywords pk ON p.id = pk.photo_id
    WHERE pk.keyword_id = $1 AND p.is_active = true
    ORDER BY p.popularity DESC
    LIMIT 50
  `, [keyword.id]);

  const response = {
    keyword: keyword.name,
    slug: keywordSlug,
    canonicalUrl: `${SITE_URL}/search?q=${encodeURIComponent(keyword.name)}`,
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
