/**
 * Sitemap Index — references all segmented sitemaps
 *
 * Structure:
 *   /sitemap.xml                    → this index
 *   /api/sitemap/galleries          → gallery URLs
 *   /api/sitemap/articles           → article URLs
 *   /api/sitemap/locations          → indexable location URLs
 *   /api/sitemap/species            → indexable species URLs
 *   /api/sitemap/photos            → first 10K photo URLs
 *   /api/sitemap/photos?page=1     → next 10K photo URLs
 *   ...etc
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const BASE = 'https://wildphotography.com';
const PHOTO_PAGE_SIZE = 10000;

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString().split('T')[0];

  // Count total published photos to determine number of sitemap pages needed
  let photoPages = [`${BASE}/api/sitemap/photos`];
  try {
    const countResult = await sql`SELECT COUNT(*) as cnt FROM photos WHERE is_active = true AND ready_for_public_render = true AND search_ready = true`;
    const total = Number(countResult[0]?.cnt || 0);
    const pageCount = Math.ceil(total / PHOTO_PAGE_SIZE);
    photoPages = Array.from({ length: pageCount }, (_, i) =>
      i === 0 ? `${BASE}/api/sitemap/photos` : `${BASE}/api/sitemap/photos?page=${i}`
    );
  } catch {
    // Fallback to single page if DB query fails
    photoPages = [`${BASE}/api/sitemap/photos`];
  }

  const sitemaps = [
    { loc: `${BASE}/api/sitemap/galleries`, lastmod: now },
    { loc: `${BASE}/api/sitemap/articles`, lastmod: now },
    { loc: `${BASE}/api/sitemap/locations`, lastmod: now },
    { loc: `${BASE}/api/sitemap/species`, lastmod: now },
    ...photoPages.map(loc => ({ loc, lastmod: now })),
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const sm of sitemaps) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${sm.loc}</loc>\n`;
    xml += `    <lastmod>${sm.lastmod}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }
  xml += '</sitemapindex>';

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=259200',
    },
  });
}
