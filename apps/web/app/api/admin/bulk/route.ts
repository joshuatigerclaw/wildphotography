import { NextRequest, NextResponse } from "next/server";
import { bulkUpdatePhotos } from "@/lib/admin/db";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ids, ...fields } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    // Prevent invalid flag combinations
    if (fields.search_ready === true) {
      return NextResponse.json(
        { error: "Bulk search_ready=true is not allowed — do it one at a time" },
        { status: 400 }
      );
    }

    const updated = await bulkUpdatePhotos(ids, {
      keywords: fields.keywords ?? null,
      gallery_id: fields.gallery_id ?? null,
      gallery_slug: fields.gallery_slug ?? null,
      search_ready: fields.search_ready,
      ready_for_public_render: fields.ready_for_public_render,
    });

    return NextResponse.json({ updated, count: ids.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
