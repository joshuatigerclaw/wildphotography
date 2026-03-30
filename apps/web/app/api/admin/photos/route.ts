import { NextRequest, NextResponse } from "next/server";
import { listPhotos } from "@/lib/admin/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;
  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  try {
    const { photos, total } = await listPhotos({
      page: parseInt(searchParams.get("page") || "1"),
      perPage: parseInt(searchParams.get("perPage") || "48"),
      search: searchParams.get("search") || "",
      filterReady:
        searchParams.get("filterReady") === "true"
          ? true
          : searchParams.get("filterReady") === "false"
            ? false
            : undefined,
      filterSearchReady:
        searchParams.get("filterSearchReady") === "true"
          ? true
          : searchParams.get("filterSearchReady") === "false"
            ? false
            : undefined,
      filterDerivatives:
        searchParams.get("filterDerivatives") === "true"
          ? true
          : searchParams.get("filterDerivatives") === "false"
            ? false
            : undefined,
      filterAiStatus:
        searchParams.get("filterAiStatus") || undefined,
      filterGallery: searchParams.get("filterGallery") || undefined,
      sortBy: searchParams.get("sortBy") || "p.id",
      sortDir: (searchParams.get("sortDir") as "asc" | "desc") || "desc",
    });

    return NextResponse.json({ photos, total });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
