/**
 * GET /api/map/gallery/[slug]
 * Returns GeoJSON for all photos in a specific gallery that have GPS coordinates.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const R2_PUBLIC = 'https://images.wildphotography.com';
export const dynamic = 'force-dynamic';

function withR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') || '300', 10), 500);

  try {
    const rows = await sql(`
      SELECT p.id, p.slug, p.title, p.thumb_url,
             p.latitude, p.longitude,
             p.location, p.city_name, p.province_name, p.gallery_slug
      FROM photos p
      JOIN gallery_photos gp ON p.id = gp.photo_id
      JOIN galleries g ON gp.gallery_id = g.id
      WHERE g.slug = $1
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND p.state NOT IN ('archived_unrecoverable', 'archived')
        AND p.ready_for_public_render = true
        AND p.thumb_url IS NOT NULL
        AND p.is_active = true
      ORDER BY p.popularity DESC NULLS LAST
      LIMIT $2
    `, [slug, limit]);

    const features = rows
      .filter((r: any) => r.latitude != null && r.longitude != null)
      .map((r: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: {
          id: r.id, slug: r.slug,
          title: r.title || r.location || 'Photo',
          thumb_url: withR2(r.thumb_url),
          location_name: r.location || null,
          city_name: r.city_name || null,
          province_name: r.province_name || null,
          gallery_slug: r.gallery_slug || null,
        },
      }));

    return NextResponse.json({ type: 'FeatureCollection', meta: { gallery: slug, count: features.length }, features });
  } catch (err: any) {
    console.error('[/api/map/gallery]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
