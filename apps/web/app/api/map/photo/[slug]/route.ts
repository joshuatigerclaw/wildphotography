/**
 * GET /api/map/photo/[slug]
 * Returns GeoJSON Feature for a single photo with coordinates.
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

  try {
    const rows = await sql(`
      SELECT p.id, p.slug, p.title, p.thumb_url,
             p.latitude, p.longitude,
             p.location, p.city_name, p.province_name, p.gallery_slug
      FROM photos p
      WHERE p.slug = $1
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND p.state NOT IN ('archived_unrecoverable', 'archived')
        AND p.is_active = true
      LIMIT 1
    `, [slug]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Photo not found or has no coordinates' }, { status: 404 });
    }

    const r = rows[0];
    return NextResponse.json({
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
        coordinates: [r.longitude, r.latitude],
      },
    });
  } catch (err: any) {
    console.error('[/api/map/photo]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
