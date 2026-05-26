import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';

export const dynamic = 'force-dynamic';

type Lead = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  selected_plan: string;
  intended_use: string | null;
  monthly_api_needs: string | null;
  message: string | null;
  status: string;
  notes: Array<{ id: number; note: string; created_at: string }>;
  created_at: string;
  updated_at: string;
};

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (token !== process.env.ADMIN_SECRET) {
    return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  if (!await adminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';

  const client = getAdminClient();
  try {
    await client.connect();

    let where = '';
    const params: unknown[] = [];
    if (status !== 'all') {
      where = 'WHERE w.status = $1';
      params.push(status);
    }

    const leadsRes = await client.query(
      `SELECT w.id, w.name, w.email, w.company, w.website,
              w.selected_plan, w.intended_use, w.monthly_api_needs, w.message,
              w.status, w.created_at::text, w.updated_at::text,
              COALESCE(
                (SELECT json_agg(json_build_object('id', n.id, 'note', n.note, 'created_at', n.created_at::text) ORDER BY n.created_at DESC)
                 FROM api_lead_notes n WHERE n.lead_id = w.id),
                '[]'
              ) AS notes
       FROM api_waitlist w
       ${where}
       ORDER BY w.created_at DESC`,
      params
    );

    const leads: Lead[] = leadsRes.rows.map(r => ({
      ...r,
      status: r.status || 'pending',
      notes: Array.isArray(r.notes) ? r.notes : [],
    }));

    return NextResponse.json({ leads });
  } catch (e) {
    console.error('API leads list error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}