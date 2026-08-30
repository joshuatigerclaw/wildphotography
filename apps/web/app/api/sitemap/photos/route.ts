/**
 * Photo Sitemap — segmented, paginated
 * Returns up to 10,000 photo URLs per page.
 * Page 0 = first 10K photos, page 1 = next 10K, etc.
 *
 * Usage:
 *   /api/sitemap/photos             → first 10K (page=0)
 *   /api/sitemap/photos?page=1     → next 10K
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';
const PER_PAGE = 10_000;

function buildXml(urls: string[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const loc of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.6</priority>\n';
    xml += '  </url>\n';
  }
  xml += '</urlset>';
  return xml;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10));
  const offset = page * PER_PAGE;

  try {
    // Fetch photo slugs in batches — only search_ready + active photos
    const result = await sql`
      SELECT slug, date_uploaded
      FROM photos
      WHERE is_active = true
        AND search_ready = true
        AND ready_for_public_render = true
        AND slug IS NOT NULL
        AND slug != ''
      ORDER BY id ASC
      LIMIT ${PER_PAGE}
      OFFSET ${offset}
    `;

    if ((result as any[]).length === 0) {
      return new NextResponse('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/></urlset>', {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    const urls = (result as any[]).map(
      (row) => `${SITE_URL}/photo/${row.slug}`
    );

    return new NextResponse(buildXml(urls), {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=259200',
      },
    });
  } catch (error) {
    console.error('[sitemap/photos] Error:', error);
    return new NextResponse('Error generating photo sitemap', { status: 500 });
  }
}
