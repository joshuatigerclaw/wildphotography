import { NextRequest, NextResponse } from "next/server";
import { getPhotoById, updatePhoto, logEdit, getEditHistory } from "@/lib/admin/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const photo = await getPhotoById(id);
    if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const history = await getEditHistory(id);
    return NextResponse.json({ photo, history });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const body = await req.json();

    // Only allow these fields to be updated
    const allowed = [
      "title",
      "description",
      "keywords",
      "location_name",
      "region",
      "country",
      "gallery_id",
      "gallery_slug",
      "species_common_name",
      "species_scientific_name",
      "search_ready",
      "ready_for_public_render",
      "description_locked",
      "ai_description_review_notes",
      "ai_description_status",
    ] as const;

    const updates: Record<string, unknown> = {};
    const original = await getPhotoById(id);
    if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

    for (const field of allowed) {
      if (body[field] !== undefined) {
        // Prevent invalid flag combinations
        if (field === "search_ready" && body[field] === true && !original.derivatives_complete) {
          return NextResponse.json(
            { error: "Cannot set search_ready=true without derivatives_complete" },
            { status: 400 }
          );
        }
        if (field === "ready_for_public_render" && body[field] === true) {
          if (!original.derivatives_complete) {
            return NextResponse.json(
              { error: "Cannot set ready_for_public_render=true without derivatives_complete" },
              { status: 400 }
            );
          }
        }

        const oldVal = String(original[field as keyof typeof original] ?? "");
        const newVal = String(body[field] ?? "");
        if (oldVal !== newVal) {
          updates[field] = body[field];
          await logEdit(id, "admin", field, oldVal, newVal);
        }
      }
    }

    if (Object.keys(updates).length) {
      // Set description_last_manual_edit_at when description is manually edited
      if (updates.description !== undefined) {
        updates.description_last_manual_edit_at = new Date().toISOString();
      }
      await updatePhoto(id, updates);
    }

    const updated = await getPhotoById(id);
    return NextResponse.json({ photo: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
