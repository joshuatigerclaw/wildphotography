import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';

export const dynamic = 'force-dynamic';

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (token !== process.env.ADMIN_SECRET) return false;
  return true;
}

// POST /api/admin/api-customers/[id]/deactivate — deactivate customer + revoke key
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const client = getAdminClient();
  try {
    await client.connect();
    await client.query(
      `UPDATE api_keys SET status = 'revoked' WHERE customer_id = $1`,
      [customerId]
    );
    await client.query(
      `UPDATE api_customers SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [customerId]
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('deactivate customer error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}
