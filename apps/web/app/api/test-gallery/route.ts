import { NextResponse } from 'next/server';
import { getGalleryBySlug } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || 'birds-macaws-lapas';
  
  try {
    const gallery = await getGalleryBySlug(slug);
    return NextResponse.json({ slug, gallery, found: !!gallery });
  } catch(e: any) {
    return NextResponse.json({ slug, error: e.message?.slice(0, 300) }, { status: 500 });
  }
}
