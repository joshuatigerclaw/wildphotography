import { NextRequest, NextResponse } from 'next/server';
import { d1Exec } from '@/lib/d1';

export const dynamic = 'force-dynamic';

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (token !== process.env.ADMIN_SECRET) return false;
  return true;
}

// POST /api/admin/api-customers/[id]/deactivate — deactivate customer + revoke key (D1 only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  await d1Exec(`UPDATE api_keys SET status = 'revoked' WHERE customer_id = ?`, [customerId]);
  await d1Exec(`UPDATE api_customers SET status = 'inactive' WHERE id = ?`, [customerId]);

  return NextResponse.json({ success: true });
}
