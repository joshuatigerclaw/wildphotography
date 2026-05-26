import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';

export const dynamic = 'force-dynamic';

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_SECRET;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await adminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const body = await req.json();
  const { action, note, assigned_plan } = body;

  const client = getAdminClient();
  try {
    await client.connect();

    // Add a note
    if (note) {
      await client.query(
        'INSERT INTO api_lead_notes (lead_id, note) VALUES ($1, $2)',
        [leadId, note]
      );
    }

    // Update status or plan
    const updates: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (action === 'approve') {
      updates.push(`status = $${i++}`);
      vals.push('approved');
    } else if (action === 'reject') {
      updates.push(`status = $${i++}`);
      vals.push('rejected');
    } else if (action === 'onboard') {
      updates.push(`status = $${i++}`);
      vals.push('onboarded');
    }

    if (assigned_plan) {
      updates.push(`selected_plan = $${i++}`);
      vals.push(assigned_plan);
    }

    if (updates.length) {
      updates.push(`updated_at = NOW()`);
      vals.push(leadId);
      await client.query(
        `UPDATE api_waitlist SET ${updates.join(', ')} WHERE id = $${i}`,
        vals
      );
    }

    // Return updated lead with notes
    const leadRes = await client.query(
      `SELECT w.id, w.name, w.email, w.company, w.website,
              w.selected_plan, w.intended_use, w.monthly_api_needs, w.message,
              w.status, w.created_at::text, w.updated_at::text,
              COALESCE(
                (SELECT json_agg(json_build_object('id', n.id, 'note', n.note, 'created_at', n.created_at::text) ORDER BY n.created_at DESC)
                 FROM api_lead_notes n WHERE n.lead_id = w.id),
                '[]'
              ) AS notes
       FROM api_waitlist w WHERE w.id = $1`,
      [leadId]
    );

    if (!leadRes.rows.length) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const lead = leadRes.rows[0];
    return NextResponse.json({
      lead: {
        ...lead,
        status: lead.status || 'pending',
        notes: Array.isArray(lead.notes) ? lead.notes : [],
      }
    });
  } catch (e) {
    console.error('API lead update error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}