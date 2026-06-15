import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require'
);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, plan, intended_use, monthly_needs, message } = body;

    if (!name || !email || !intended_use) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';

    await sql`
      INSERT INTO api_access_requests (name, email, company, plan_slug, intended_use, monthly_needs, message, ip_address, user_agent)
      VALUES (
        ${name}, ${email}, ${company || null}, ${plan || null},
        ${intended_use}, ${monthly_needs || null}, ${message || null},
        ${ip}, ${ua}
      )
    `;

    // TODO: Send notification email to josh@wildphotography.com
    // For now, the submission is stored and can be reviewed via direct DB access

    return NextResponse.json({ success: true, message: 'Request received' }, { status: 200 });
  } catch (e: any) {
    console.error('api-access-request error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}