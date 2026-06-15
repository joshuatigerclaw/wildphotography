import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const CDN_BASE = "https://images.wildphotography.com";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = await sql`
      SELECT
        id,
        status,
        source_cdn_url,
        free_output_r2_key,
        premium_output_r2_key,
        stripe_payment_status,
        error_message,
        created_at
      FROM you_in_costa_rica_jobs
      WHERE id = ${id}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const row = result[0] as any;

    // Build response
    const response: Record<string, any> = {
      id: String(row.id),
      status: row.status,
      sourceCdnUrl: row.source_cdn_url,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };

    // Include free output CDN URL if ready
    if (row.status === "free_ready" && row.free_output_r2_key) {
      response.freeOutputCdnUrl = `${CDN_BASE}/${row.free_output_r2_key}`;
    }

    // Include premium output CDN URL if ready
    if (row.status === "premium_ready" && row.premium_output_r2_key) {
      response.premiumOutputCdnUrl = `${CDN_BASE}/${row.premium_output_r2_key}`;
    }

    // Include Stripe payment info if applicable
    if (row.stripe_payment_status) {
      response.stripePaymentStatus = row.stripe_payment_status;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[you-in-costa-rica/job/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
