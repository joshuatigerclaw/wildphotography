import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getJobById } from "@/lib/you-in-costa-rica";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET && token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const job = await getJobById(params.id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(job);
  } catch (e) {
    console.error("[admin/job/GET]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET && token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sql`
      UPDATE you_in_costa_rica_jobs
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${params.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/job/DELETE]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET && token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === "regenerate") {
      // Reset to uploaded, clear outputs — trigger reprocessing
      await sql`
        UPDATE you_in_costa_rica_jobs
        SET
          status = 'uploaded',
          free_output_r2_key = NULL,
          premium_output_r2_key = NULL,
          error_message = NULL,
          updated_at = NOW()
        WHERE id = ${params.id}
      `;
      return NextResponse.json({ ok: true, status: "uploaded" });
    }

    if (action === "refund") {
      // Mark as refunded via error_message field (simple flag approach)
      const existing = await getJobById(params.id);
      const note = `[REFUND] ${new Date().toISOString()} — Admin action`;
      await sql`
        UPDATE you_in_costa_rica_jobs
        SET
          stripe_payment_status = 'refunded',
          error_message = COALESCE(error_message || ' ' || ${note}, ${note}),
          updated_at = NOW()
        WHERE id = ${params.id}
      `;
      return NextResponse.json({ ok: true, stripePaymentStatus: "refunded" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[admin/job/POST]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}