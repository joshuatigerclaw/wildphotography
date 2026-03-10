import { NextRequest, NextResponse } from 'next/server';
import { recordPhotoVisit } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photoId, slug } = body;
    
    if (!photoId || !slug) {
      return NextResponse.json({ error: 'Missing photoId or slug' }, { status: 400 });
    }
    
    const referrer = request.headers.get('referer') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;
    
    await recordPhotoVisit(parseInt(photoId), slug, referrer, userAgent);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[visit] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
