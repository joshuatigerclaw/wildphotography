/**
 * Species Sitemap — all species (mostly noindex due to thin content)
 * Only species pages that meet the indexability threshold are included.
 * Most species pages have 1 photo and should not be indexed per Phase 13 thresholds.
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { speciesIndexable } from '@/lib/seo-config';

const SITE_URL = 'https://wildphotography.com';

function buildXml(entries: { url: string }[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const entry of entries) {
    xml += '  <url>\n';
    xml += `    <loc>${entry.url}</loc>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.6</priority>\n';
    xml += '  </url>\n';
  }
  xml += '</urlset>';
  return xml;
}

export async function GET() {
  try {
    const result = await sql`
      SELECT s.slug, s.common_name, s.photo_count,
             (s.ai_intro IS NOT NULL AND s.ai_intro != '') OR
             (s.meta_description IS NOT NULL AND s.meta_description != '') as has_editorial
      FROM species s
      ORDER BY s.photo_count DESC NULLS LAST
    `;

    const entries = (result as any[])
      .filter(row => {
        const { indexable } = speciesIndexable(
          row.photo_count || 0,
          row.has_editorial
        );
        return indexable;
      })
      .map(row => ({
        url: `${SITE_URL}/species/${row.slug}`,
      }));

    return new NextResponse(buildXml(entries), {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=259200',
      },
    });
  } catch (error) {
    console.error('[sitemap/species] Error:', error);
    return new NextResponse('Error generating species sitemap', { status: 500 });
  }
}
