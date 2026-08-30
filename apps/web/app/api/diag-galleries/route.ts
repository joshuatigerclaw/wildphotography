import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_GonqSbJlRi71@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&preferHttp=true';

const sql = neon(DATABASE_URL);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Test simple query
    const simple = await sql`SELECT 1 as n`;

    // Test galleries query (same as getGalleries but limited)
    const galleries = await sql`
      SELECT g.id, g.slug, g.name, COUNT(gp.photo_id) as "photoCount"
      FROM galleries g
      LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id
      WHERE g.is_active = true
      GROUP BY g.id
      ORDER BY g.sort_order, g.name
      LIMIT 5
    `;

    return NextResponse.json({
      ok: true,
      simple: simple[0],
      galleryCount: galleries.length,
      galleries: galleries.map(g => ({ id: g.id, slug: g.slug, name: g.name }))
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, stack: String((e as Error).stack).slice(0, 500) }, { status: 500 });
  }
}