import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const sql = neon(process.env.DATABASE_URL!);

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await sql(`
    SELECT site_name, article_title, source_url, domain, first_found_at
    FROM photo_usage_credits
    WHERE status = 'verified' AND published = true
    ORDER BY site_name ASC, article_title ASC
    LIMIT 200
  `);
  return NextResponse.json(rows);
}
