/**
 * Gallery Sitemap — all active galleries with 5+ photos
 * Only includes galleries that meet the minimum threshold for indexability.
 */
import { NextResponse } from 'next/server';
import { getGalleries } from '@/lib/db';
import { galleryIndexable } from '@/lib/seo-config';

const SITE_URL = 'https://wildphotography.com';

function buildXml(entries: { url: string; lastmod?: string }[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const entry of entries) {
    xml += '  <url>\n';
    xml += `    <loc>${entry.url}</loc>\n`;
    if (entry.lastmod) {
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    }
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }
  xml += '</urlset>';
  return xml;
}

export async function GET() {
  try {
    const galleries = await getGalleries();

    const entries = galleries
      .filter(g => galleryIndexable(g.photoCount))
      .map(g => ({
        url: `${SITE_URL}/gallery/${g.slug}`,
      }));

    return new NextResponse(buildXml(entries), {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=259200',
      },
    });
  } catch (error) {
    console.error('[sitemap/galleries] Error:', error);
    return new NextResponse('Error generating gallery sitemap', { status: 500 });
  }
}
