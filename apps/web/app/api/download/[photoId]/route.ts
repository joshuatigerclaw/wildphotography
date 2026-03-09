/**
 * Download API
 * 
 * GET /api/download/[photoId]
 * Query: ?token=<download-token>
 * 
 * Returns signed download URL or serves the file
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    const { photoId } = await params;
    const token = request.nextUrl.searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ error: 'Download token required' }, { status: 401 });
    }
    
    const photoIdNum = parseInt(photoId);
    if (isNaN(photoIdNum)) {
      return NextResponse.json({ error: 'Invalid photo ID' }, { status: 400 });
    }
    
    // Find fulfillment
    const fulfillments = await sql(`
      SELECT f.*, o.status as order_status
      FROM fulfillments f
      JOIN orders o ON f.order_id = o.id
      WHERE f.download_token = $1 AND o.status = 'completed'
    `, [token]);
    
    if (fulfillments.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired download token' }, { status: 403 });
    }
    
    const fulfillment = fulfillments[0];
    
    // Check expiration
    if (new Date(fulfillment.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Download token expired' }, { status: 403 });
    }
    
    // Check download count
    if (fulfillment.download_count >= fulfillment.max_downloads) {
      return NextResponse.json({ error: 'Maximum downloads exceeded' }, { status: 403 });
    }
    
    // Get photo
    const photos = await sql('SELECT * FROM photos WHERE id = $1', [photoIdNum]);
    if (photos.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    
    const photo = photos[0];
    
    // Increment download count
    await sql('UPDATE fulfillments SET download_count = download_count + 1 WHERE id = $1', 
      [fulfillment.id]);
    
    // Return download info (actual file serving requires R2 signed URL)
    return NextResponse.json({
      photoTitle: photo.title,
      originalKey: photo.original_r2_key,
      expiresAt: fulfillment.expires_at,
      remainingDownloads: fulfillment.max_downloads - fulfillment.download_count - 1,
      message: 'Download verified - implement R2 signed URL for actual file serving',
    });
  } catch (error: any) {
    console.error('[download] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
