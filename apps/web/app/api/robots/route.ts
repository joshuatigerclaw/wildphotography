import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const robots = `# Wildphotography Robots.txt

User-agent: *
Allow: /

# Sitemap
Sitemap: https://wildphotography.com/api/sitemap

# Disallow private areas
Disallow: /api/
Disallow: /admin/
`;

  return new NextResponse(robots, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
