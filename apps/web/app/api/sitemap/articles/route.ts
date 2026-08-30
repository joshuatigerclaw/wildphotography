/**
 * Article Sitemap — all published articles
 */
import { NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/db';

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
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }
  xml += '</urlset>';
  return xml;
}

export async function GET() {
  try {
    const articles = await getAllArticles();

    const entries = articles
      .filter(a => a.status === 'published')
      .map(a => ({
        url: `${SITE_URL}/article/${a.slug}`,
        lastmod: a.updatedAt
          ? new Date(a.updatedAt).toISOString().split('T')[0]
          : undefined,
      }));

    return new NextResponse(buildXml(entries), {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=259200',
      },
    });
  } catch (error) {
    console.error('[sitemap/articles] Error:', error);
    return new NextResponse('Error generating article sitemap', { status: 500 });
  }
}
