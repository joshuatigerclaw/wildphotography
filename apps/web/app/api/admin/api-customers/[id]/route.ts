import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';
import { d1Query } from '@/lib/d1';

export const dynamic = 'force-dynamic';

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (token !== process.env.ADMIN_SECRET) return false;
  return true;
}

// GET /api/admin/api-customers/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const now = new Date();
  const yearMonth = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;

  // ── Try D1 first ────────────────────────────────────────────────────────
  const row = await d1Query(
    `SELECT c.id, c.email, c.name, c.company, c.plan_id, c.plan_name,
            c.monthly_call_limit, c.status, c.created_at,
            k.key_prefix, k.status AS key_status, k.last_used_at,
            u.calls_used
     FROM api_customers c
     LEFT JOIN api_keys k ON k.customer_id = c.id AND k.status = 'active'
     LEFT JOIN api_monthly_usage u ON u.customer_id = c.id AND u.period_yyyymm = ?
     WHERE c.id = ?`,
    [yearMonth, parseInt(id)]
  );

  if (row) {
    return NextResponse.json({ customer: row });
  }

  // ── Fallback: Neon ──────────────────────────────────────────────────────
  console.log('[admin] customer detail: D1 failed, falling back to Neon for id=' + id);
  const client = getAdminClient();
  try {
    await client.connect();
    const res = await client.query(
      `SELECT c.id, c.email, c.name, c.company, c.plan_id, c.plan_name,
              c.monthly_call_limit, c.status, c.created_at::text,
              k.key_prefix, k.status AS key_status, k.last_used_at::text AS last_used_at,
              u.calls_used
       FROM api_customers c
       LEFT JOIN api_keys k ON k.customer_id = c.id AND k.status = 'active'
       LEFT JOIN api_monthly_usage u ON u.customer_id = c.id AND u.period_yyyymm = $1
       WHERE c.id = $2`,
      [yearMonth, id]
    );
    if (!res.rows.length) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ customer: res.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}
