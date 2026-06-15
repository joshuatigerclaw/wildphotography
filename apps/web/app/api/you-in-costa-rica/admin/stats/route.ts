import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET && token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql(`
      SELECT status, count(*)::int as count
      FROM you_in_costa_rica_jobs
      GROUP BY status
    `);

    const map: Record<string, number> = {};
    let total = 0;
    for (const row of result as any[]) {
      map[row.status] = parseInt(row.count, 10);
      total += parseInt(row.count, 10);
    }

    return NextResponse.json({
      total,
      uploaded: map.uploaded ?? 0,
      processing: map.processing ?? 0,
      free_ready: map.free_ready ?? 0,
      payment_pending: map.payment_pending ?? 0,
      premium_ready: map.premium_ready ?? 0,
      failed: map.failed ?? 0,
      deleted: map.deleted ?? 0,
    });
  } catch (e) {
    console.error("[admin/stats]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}