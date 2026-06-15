import { NextRequest, NextResponse } from 'next/server';
import { d1Query } from '@/lib/d1';

export const dynamic = 'force-dynamic';

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (token !== process.env.ADMIN_SECRET) return false;
  return true;
}

// GET /api/admin/api-customers/[id] — customer detail (D1 only)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const now = new Date();
  const yearMonth = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;

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

  if (!row) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ customer: row });
}
