import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

export async function POST(request: NextRequest) {
  try {
    const sql = neon(DATABASE_URL);
    
    const body = await request.json();
    const { photoId, slug } = body;
    
    if (!photoId || !slug) {
      return NextResponse.json({ error: 'Missing photoId or slug' }, { status: 400 });
    }
    
    // Get client IP (use forwarded header if behind proxy)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip')
      || 'unknown';
    
    const referrer = request.headers.get('referer') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;
    
    // Check for recent visit from same IP (within 30 minutes) to prevent inflation
    const existingVisit = await sql`
      SELECT id FROM photo_visits 
      WHERE photo_id = ${parseInt(photoId)} 
        AND ip_address = ${ip}
        AND visited_at > NOW() - INTERVAL '30 minutes'
      LIMIT 1
    `;
    
    if (existingVisit.length > 0) {
      // Already visited recently, just return success
      return NextResponse.json({ success: true, counted: false });
    }
    
    // Insert visit record
    await sql`
      INSERT INTO photo_visits (photo_id, slug, referrer, user_agent, ip_address, visited_at)
      VALUES (${parseInt(photoId)}, ${slug}, ${referrer || null}, ${userAgent || null}, ${ip}, NOW())
    `;
    
    // Update aggregate count on photo
    await sql`
      UPDATE photos SET views_count = COALESCE(views_count, 0) + 1
      WHERE id = ${parseInt(photoId)}
    `;
    
    return NextResponse.json({ success: true, counted: true });
  } catch (error) {
    console.error('[visit] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
