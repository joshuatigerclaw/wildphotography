import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';
import { d1QueryAll } from '@/lib/d1';

export const dynamic = 'force-dynamic';

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (token !== process.env.ADMIN_SECRET) return false;
  return true;
}

type CustomerRow = {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  plan_id: string;
  plan_name: string;
  monthly_call_limit: number;
  status: string;
  key_prefix: string | null;
  key_status: string | null;
  last_used_at: string | null;
  calls_used: number | null;
  created_at: string;
};

// GET /api/admin/api-customers — list all customers with usage
export async function GET(req: NextRequest) {
  if (!await adminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const yearMonth = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;

  // ── Try D1 first ────────────────────────────────────────────────────────
  const rows = await d1QueryAll<CustomerRow>(
    `SELECT c.id, c.email, c.name, c.company,
            c.plan_id, c.plan_name, c.monthly_call_limit, c.status,
            c.created_at,
            k.key_prefix,
            k.status AS key_status,
            k.last_used_at,
            u.calls_used
     FROM api_customers c
     LEFT JOIN api_keys k ON k.customer_id = c.id AND k.status = 'active'
     LEFT JOIN api_monthly_usage u ON u.customer_id = c.id AND u.period_yyyymm = ?
     ORDER BY c.created_at DESC`,
    [yearMonth]
  );

  if (rows) {
    return NextResponse.json({ customers: rows });
  }

  // ── Fallback: Neon ──────────────────────────────────────────────────────
  console.log('[admin] api-customers: D1 failed, falling back to Neon');
  const client = getAdminClient();
  try {
    await client.connect();
    const res = await client.query(
      `SELECT c.id, c.email, c.name, c.company,
              c.plan_id, c.plan_name, c.monthly_call_limit, c.status,
              c.created_at::text,
              k.key_prefix,
              k.status AS key_status,
              k.last_used_at::text AS last_used_at,
              u.calls_used
       FROM api_customers c
       LEFT JOIN api_keys k ON k.customer_id = c.id AND k.status = 'active'
       LEFT JOIN api_monthly_usage u ON u.customer_id = c.id AND u.period_yyyymm = $1
       ORDER BY c.created_at DESC`,
      [yearMonth]
    );
    return NextResponse.json({ customers: res.rows });
  } catch (e) {
    console.error('api-customers list error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}
