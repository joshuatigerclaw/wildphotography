import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sourcePhotoId,
      sourcePhotoSlug,
      sourceGallerySlug,
      sourceR2Key,
      sourceCdnUrl,
      uploadedUserR2Key,
      uploadedUserMime,
      uploadedUserSize,
      sessionId,
      userEmail,
    } = body as {
      sourcePhotoId?: string;
      sourcePhotoSlug?: string;
      sourceGallerySlug?: string;
      sourceR2Key?: string;
      sourceCdnUrl?: string;
      uploadedUserR2Key?: string;
      uploadedUserMime?: string;
      uploadedUserSize?: number;
      sessionId?: string;
      userEmail?: string;
    };

    // Validate required fields
    if (!sourceR2Key || !uploadedUserR2Key) {
      return NextResponse.json(
        { error: "Missing required fields: sourceR2Key, uploadedUserR2Key" },
        { status: 400 }
      );
    }

    if (!sourcePhotoId) {
      return NextResponse.json(
        { error: "Missing required field: sourcePhotoId" },
        { status: 400 }
      );
    }

    // Insert into you_in_costa_rica_jobs
    const result = await sql`
      INSERT INTO you_in_costa_rica_jobs (
        user_email,
        session_id,
        source_photo_id,
        source_photo_slug,
        source_gallery_slug,
        source_r2_key,
        source_cdn_url,
        uploaded_user_r2_key,
        uploaded_user_mime,
        uploaded_user_size,
        prompt,
        status
      ) VALUES (
        ${userEmail || null},
        ${sessionId || null},
        ${sourcePhotoId},
        ${sourcePhotoSlug || null},
        ${sourceGallerySlug || null},
        ${sourceR2Key},
        ${sourceCdnUrl || null},
        ${uploadedUserR2Key},
        ${uploadedUserMime || null},
        ${uploadedUserSize || null},
        'You in Costa Rica composite',
        'uploaded'
      )
      RETURNING id, status, created_at
    `;

    const row = result[0] as any;
    return NextResponse.json({
      jobId: String(row.id),
      status: row.status,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error("[you-in-costa-rica/create]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
