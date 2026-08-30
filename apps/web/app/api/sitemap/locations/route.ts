/**
 * Location Sitemap — all locations with 8+ photos (indexable threshold)
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { locationIndexable } from '@/lib/seo-config';

const SITE_URL = 'https://wildphotography.com';

function buildXml(entries: { url: string; indexable?: boolean; lastmod?: string }[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '  xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  for (const entry of entries) {
    xml += '  <url>\n';
    xml += `    <loc>${entry.url}</loc>\n`;
    if (!entry.indexable) {
      // Signal Google to crawl but not index thin location pages
      xml += '    <xhtml:link rel="alternate" hreflang="en" href="__NOINDEX__" />\n';
    }
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';
  }
  xml += '</urlset>';
  return xml;
}

export async function GET() {
  try {
    const result = await sql`
      SELECT l.slug, l.name, l.photo_count,
             l.description IS NOT NULL AND l.description != '' as has_editorial
      FROM locations l
      ORDER BY l.name
    `;

    const entries = (result as any[]).map(row => {
      const indexable = locationIndexable(
        row.photo_count || 0,
        row.has_editorial
      );
      return {
        url: `${SITE_URL}/location/${row.slug}`,
        indexable: indexable.indexable,
      };
    });

    // Only include indexable locations
    const indexableEntries: { url: string }[] = entries
      .filter(e => e.indexable)
      .map(({ url }) => ({ url }));

    return new NextResponse(buildXml(indexableEntries), {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=259200',
      },
    });
  } catch (error) {
    console.error('[sitemap/locations] Error:', error);
    return new NextResponse('Error generating location sitemap', { status: 500 });
  }
}
