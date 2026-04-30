import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const sql = neon(DATABASE_URL);

function withR2(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

export const dynamic = 'force-dynamic';

// Simple bot check
function isBot(ua: string): boolean {
  return /headless|python|curl|wget|scrapy|axios|phantom|selenium|playwright|puppeteer/i.test(ua);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (isBot(ua)) {
      return NextResponse.json({ error: 'Rate limited' }, { 
        status: 429,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const { id } = await params;
    const photoId = parseInt(id);
    if (isNaN(photoId)) {
      return NextResponse.json({ error: 'Invalid photo ID' }, { status: 400 });
    }

    const photoMeta = await sql`
      SELECT p.id, p.slug, p.title, p.location, p.region, p.species_common_name,
             p.species_scientific_name, p.keywords, p.thumb_url, p.small_url,
             p.featured, p.popularity
      FROM photos p
      WHERE p.id = ${photoId}
    `;

    if (photoMeta.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const photo = photoMeta[0] as any;

    const relatedResult = await sql`
      WITH scored_photos AS (
        SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
               p.species_common_name, p.location,
               40 AS score
        FROM photos p
        JOIN photo_species ps ON ps.photo_id = p.id
        JOIN photo_species ps2 ON ps2.species_id = ps.species_id
        JOIN page_links pl ON pl.source_type = 'photo' AND pl.source_id = ${photoId}
                          AND pl.target_type = 'species'
        WHERE ps2.photo_id = p.id AND p.id != ${photoId}
          AND p.is_active = true AND p.ready_for_public_render = true

        UNION ALL

        SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
               p.species_common_name, p.location,
               30 AS score
        FROM photos p
        JOIN page_links pl ON pl.source_type = 'photo' AND pl.source_id = ${photoId}
                          AND pl.target_type = 'location'
        WHERE p.id != ${photoId}
          AND p.is_active = true AND p.ready_for_public_render = true
          AND (
            (pl.target_id = (SELECT id FROM locations WHERE name = p.location LIMIT 1))
            OR p.location ILIKE '%' || (SELECT name FROM locations WHERE id = pl.target_id LIMIT 1) || '%'
          )

        UNION ALL

        SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
               p.species_common_name, p.location,
               25 AS score
        FROM photos p
        JOIN gallery_photos gp ON gp.photo_id = p.id
        JOIN gallery_photos gp2 ON gp2.gallery_id = gp.gallery_id
        WHERE gp2.photo_id = ${photoId} AND p.id != ${photoId}
          AND p.is_active = true AND p.ready_for_public_render = true

        UNION ALL

        SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
               p.species_common_name, p.location,
               15 AS score
        FROM photos p
        WHERE p.region = ${photo.region || ''}
          AND p.id != ${photoId}
          AND p.is_active = true AND p.ready_for_public_render = true
          AND p.region IS NOT NULL AND p.region != ''

        UNION ALL

        SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
               p.species_common_name, p.location,
               40 AS score
        FROM photos p
        WHERE p.species_common_name = ${photo.species_common_name || ''}
          AND p.id != ${photoId}
          AND p.is_active = true AND p.ready_for_public_render = true
          AND p.species_common_name IS NOT NULL AND p.species_common_name != ''

        UNION ALL

        SELECT DISTINCT p.id, p.slug, p.title, p.thumb_url, p.small_url,
               p.species_common_name, p.location,
               5 AS score
        FROM photos p
        WHERE p.featured = true
          AND p.id != ${photoId}
          AND p.is_active = true AND p.ready_for_public_render = true
      )
      SELECT id, slug, title, thumb_url, small_url,
             species_common_name, location,
             SUM(score) as total_score
      FROM scored_photos
      GROUP BY id, slug, title, thumb_url, small_url, species_common_name, location
      ORDER BY total_score DESC, popularity DESC NULLS LAST
      LIMIT 12
    `;

    const photos = (relatedResult as any[]).map(row => ({
      id: String(row.id),
      slug: row.slug,
      title: row.title || '',
      thumbUrl: withR2(row.thumb_url),
      smallUrl: withR2(row.small_url),
      species_common_name: row.species_common_name,
      location_name: row.location,
      score: Number(row.total_score),
    }));

    return NextResponse.json({ photos }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
        'CDN-Cache-Control': 'public, max-age=600',
      }
    });
  } catch (error) {
    console.error('[api/photos/related] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
