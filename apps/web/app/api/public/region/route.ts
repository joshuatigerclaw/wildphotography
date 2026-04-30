import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const regions = await sql`
      SELECT id, name, slug, description, photo_count, gallery_count
      FROM regions 
      WHERE status = 'active'
      ORDER BY name ASC
    `;
    
    return NextResponse.json({ regions }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=14400',
      }
    });
  } catch (error) {
    console.error('[region] Error:', error);
    return NextResponse.json({ error: 'Failed to load regions' }, { status: 500 });
  }
}
