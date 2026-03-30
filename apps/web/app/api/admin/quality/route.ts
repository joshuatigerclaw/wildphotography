import { NextRequest, NextResponse } from "next/server";
import { getQualityQueue } from "@/lib/admin/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const issues = await getQualityQueue();
    return NextResponse.json({ issues });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
