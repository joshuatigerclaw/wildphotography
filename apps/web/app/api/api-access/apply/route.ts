import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface WaitlistEntry {
  name: string;
  email: string;
  company?: string;
  website?: string;
  selected_plan: string;
  intended_use?: string;
  monthly_api_needs?: string;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as WaitlistEntry;

    const { name, email, company, website, selected_plan, intended_use, monthly_api_needs, message } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (!selected_plan) {
      return NextResponse.json({ error: 'Plan selection is required' }, { status: 400 });
    }

    const validPlans = ['explorer', 'professional', 'enterprise'];
    if (!validPlans.includes(selected_plan)) {
      return NextResponse.json({ error: 'Invalid plan selection' }, { status: 400 });
    }

    await sql`
      INSERT INTO api_waitlist (name, email, company, website, selected_plan, intended_use, monthly_api_needs, message)
      VALUES (
        ${name.trim()},
        ${email.toLowerCase().trim()},
        ${company?.trim() || null},
        ${website?.trim() || null},
        ${selected_plan},
        ${intended_use?.trim() || null},
        ${monthly_api_needs?.trim() || null},
        ${message?.trim() || null}
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Application received. We will review your request and contact you with onboarding instructions.',
    });
  } catch (error) {
    console.error('API waitlist error:', error);
    return NextResponse.json({ error: 'Failed to process application' }, { status: 500 });
  }
}