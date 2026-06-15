import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const tests: Record<string, unknown> = {};

  try {
    const r1 = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'galleries' ORDER BY ordinal_position`;
    tests.galleries_schema = r1;
  } catch (e: any) {
    tests.galleries_schema = { error: e.message };
  }

  try {
    const r2 = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'gallery_photos' ORDER BY ordinal_position`;
    tests.gallery_photos_schema = r2;
  } catch (e: any) {
    tests.gallery_photos_schema = { error: e.message };
  }

  try {
    const r3 = await sql`SELECT g.id, g.slug, g.name, g.sort_order FROM galleries g WHERE g.is_active = true ORDER BY g.name LIMIT 5`;
    tests.simple_galleries = { ok: true, count: (r3 as any[]).length };
  } catch (e: any) {
    tests.simple_galleries = { error: e.message };
  }

  return NextResponse.json(tests);
}
