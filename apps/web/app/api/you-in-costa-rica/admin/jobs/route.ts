import { NextRequest, NextResponse } from "next/server";
import { getJobsForAdmin } from "@/lib/you-in-costa-rica";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET && token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || undefined;
  const dateRange = searchParams.get("dateRange") || "30";
  const search = searchParams.get("search") || undefined;
  const limit = parseInt(searchParams.get("limit") || "24");

  // Build filter for date range
  let dateFilter: { status?: string; userEmail?: string; sessionId?: string } = {};
  if (status) dateFilter.status = status;
  if (search) {
    // Search can be job ID or email
    if (search.includes("@")) {
      dateFilter.userEmail = search;
    } else {
      // Assume job ID partial match via sessionId (actual UUID search)
      dateFilter.sessionId = search;
    }
  }

  try {
    const result = await getJobsForAdmin(page, dateFilter);
    return NextResponse.json({
      jobs: result.jobs,
      total: result.total,
      page,
      totalPages: result.totalPages,
    });
  } catch (e) {
    console.error("[admin/jobs]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}