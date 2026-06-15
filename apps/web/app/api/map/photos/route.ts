/**
 * GET /api/map/photos
 * Returns GeoJSON FeatureCollection of geotagged photos.
 * Used by: CostaRicaPhotoMap, ProgressiveCostaRicaMap
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') || '700', 10), 1000);
  const gallery = searchParams.get('gallery');
  const province = searchParams.get('province');

  try {
    const params: any[] = [];
    let where = `
      p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND p.state NOT IN ('archived_unrecoverable', 'archived')
      AND p.ready_for_public_render = true
      AND p.thumb_url IS NOT NULL
      AND p.is_active = true
    `;
    if (gallery) {
      where += ` AND p.gallery_slug = $${params.length + 1}`;
      params.push(gallery);
    }
    if (province) {
      where += ` AND p.province_name = $${params.length + 1}`;
      params.push(province);
    }

    const query = `
      SELECT p.id, p.slug, p.title, p.thumb_url,
             p.latitude, p.longitude,
             p.location, p.city_name, p.province_name, p.gallery_slug
      FROM photos p
      WHERE ${where}
      ORDER BY p.popularity DESC NULLS LAST
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const rows = await sql(query, params);

    const features = rows
      .filter((r: any) => r.latitude != null && r.longitude != null)
      .map((r: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [r.longitude, r.latitude],
        },
        properties: {
          id: r.id,
          slug: r.slug,
          title: r.title || r.location || 'Photo',
          thumb_url: withR2(r.thumb_url),
          location_name: r.location || null,
          city_name: r.city_name || null,
          province_name: r.province_name || null,
          gallery_slug: r.gallery_slug || null,
        },
      }));

    return NextResponse.json({ type: 'FeatureCollection', total: rows.length, features });
  } catch (err: any) {
    console.error('[/api/map/photos]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
