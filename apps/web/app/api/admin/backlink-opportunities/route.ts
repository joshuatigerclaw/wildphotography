import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// GET /api/admin/backlink-opportunities — list all opportunities
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';

  if (ADMIN_PASSWORD && token !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const domain = request.nextUrl.searchParams.get('domain') || '';
    const status = request.nextUrl.searchParams.get('status') || '';

    let query = sql`
      SELECT id, source_domain, page_url, page_title, credit_found,
             backlink_found, contact_email, outreach_status,
             first_seen_at, last_checked_at, notes
      FROM backlink_opportunities
      WHERE 1=1
    `;

    if (domain) {
      query = sql`SELECT id, source_domain, page_url, page_title, credit_found,
             backlink_found, contact_email, outreach_status,
             first_seen_at, last_checked_at, notes
      FROM backlink_opportunities
      WHERE source_domain ILIKE ${'%' + domain + '%'}
      ORDER BY last_checked_at DESC
      LIMIT 200`;
    } else if (status) {
      query = sql`SELECT id, source_domain, page_url, page_title, credit_found,
             backlink_found, contact_email, outreach_status,
             first_seen_at, last_checked_at, notes
      FROM backlink_opportunities
      WHERE outreach_status = ${status}
      ORDER BY last_checked_at DESC
      LIMIT 200`;
    } else {
      query = sql`SELECT id, source_domain, page_url, page_title, credit_found,
             backlink_found, contact_email, outreach_status,
             first_seen_at, last_checked_at, notes
      FROM backlink_opportunities
      ORDER BY last_checked_at DESC
      LIMIT 200`;
    }

    const items = await query;
    return NextResponse.json({ items });
  } catch (e: any) {
    // Table may not exist yet
    return NextResponse.json({ items: [], error: e.message });
  }
}

// POST /api/admin/backlink-opportunities — create/update opportunity
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';

  if (ADMIN_PASSWORD && token !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      source_domain, page_url, page_title,
      credit_found, backlink_found,
      contact_email, outreach_status, notes,
    } = body;

    if (!source_domain) {
      return NextResponse.json({ error: 'source_domain is required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO backlink_opportunities (
        source_domain, page_url, page_title,
        credit_found, backlink_found,
        contact_email, outreach_status, notes
      ) VALUES (
        ${source_domain},
        ${page_url || null},
        ${page_title || null},
        ${credit_found || false},
        ${backlink_found || false},
        ${contact_email || null},
        ${outreach_status || 'pending'},
        ${notes || null}
      )
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result[0]?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/admin/backlink-opportunities — update a record
export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';

  if (ADMIN_PASSWORD && token !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, outreach_status, credit_found, backlink_found, notes, contact_email } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (outreach_status !== undefined) { updates.push('outreach_status'); values.push(outreach_status); }
    if (credit_found !== undefined) { updates.push('credit_found'); values.push(credit_found); }
    if (backlink_found !== undefined) { updates.push('backlink_found'); values.push(backlink_found); }
    if (notes !== undefined) { updates.push('notes'); values.push(notes); }
    if (contact_email !== undefined) { updates.push('contact_email'); values.push(contact_email); }
    updates.push('last_checked_at'); values.push(new Date());

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const setClause = updates.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const queryText = `UPDATE backlink_opportunities SET ${setClause} WHERE id = $${values.length} RETURNING id`;

    // Use raw query via neon
    await sql(queryText, ...values).catch(() => {
      return sql`UPDATE backlink_opportunities SET outreach_status = ${outreach_status || 'pending'}, last_checked_at = NOW() WHERE id = ${id}`;
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}