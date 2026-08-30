import { NextRequest, NextResponse } from "next/server";

// Permanent redirects for duplicate whale articles → canonical
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect /admin → /admin/dashboard
  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  // 301 redirects: duplicate whale articles → primary canonical article
  // Canonical target: whale-watching-season-costa-rica-photography
  const whaleDuplicates: Record<string, string> = {
    "/article/whale-watching-costa-rica": "/article/whale-watching-season-costa-rica-photography",
    "/article/humpback-whale-costa-rica": "/article/whale-watching-season-costa-rica-photography",
    "/article/humpback-whale-costa-rica-photography-guide": "/article/whale-watching-season-costa-rica-photography",
    "/article/humpback-whale-costa-rica-photography-guide-2026": "/article/whale-watching-season-costa-rica-photography",
    "/article/humpback-whale-photography-costa-rica-guide": "/article/whale-watching-season-costa-rica-photography",
    "/article/whale-watching-dolphin-encounters-costa-rica-2026": "/article/whale-watching-season-costa-rica-photography",
  };

  if (whaleDuplicates[pathname]) {
    const target = whaleDuplicates[pathname];
    const url = new URL(target, req.url);
    // Preserve query strings
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 301);
  }

  // 301 redirects: duplicate Playa Hermosa Guanacaste articles → primary canonical
  // Canonical target: playa-hermosa-guanacaste-costa-rica-photography-guide-2026
  const hermosaGuanacasteDuplicates: Record<string, string> = {
    "/article/playa-hermosa-guanacaste": "/article/playa-hermosa-guanacaste-costa-rica-photography-guide-2026",
    "/article/playa-hermosa-guanacaste-costa-rica": "/article/playa-hermosa-guanacaste-costa-rica-photography-guide-2026",
    "/article/playa-hermosa-guanacaste-complete-photography-guide": "/article/playa-hermosa-guanacaste-costa-rica-photography-guide-2026",
    "/article/playa-hermosa-guanacaste-costa-rica-2026-photography-guide": "/article/playa-hermosa-guanacaste-costa-rica-photography-guide-2026",
  };

  if (hermosaGuanacasteDuplicates[pathname]) {
    const target = hermosaGuanacasteDuplicates[pathname];
    const url = new URL(target, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 301);
  }

  // 301 redirects: duplicate Jaco / Central Pacific Playa Hermosa articles → primary canonical
  // Canonical target: jaco-beach-playa-hermosa-costa-rica-photography-guide
  const hermosaJacoDuplicates: Record<string, string> = {
    "/article/playa-hermosa-jaco-garabito": "/article/jaco-beach-playa-hermosa-costa-rica-photography-guide",
    "/article/jaco-beach-playa-hermosa-central-pacific-photography-guide": "/article/jaco-beach-playa-hermosa-costa-rica-photography-guide",
  };

  if (hermosaJacoDuplicates[pathname]) {
    const target = hermosaJacoDuplicates[pathname];
    const url = new URL(target, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    // Whale articles
    "/article/whale-watching-costa-rica",
    "/article/humpback-whale-costa-rica",
    "/article/humpback-whale-costa-rica-photography-guide",
    "/article/humpback-whale-costa-rica-photography-guide-2026",
    "/article/humpback-whale-photography-costa-rica-guide",
    "/article/whale-watching-dolphin-encounters-costa-rica-2026",
    // Playa Hermosa Guanacaste articles
    "/article/playa-hermosa-guanacaste",
    "/article/playa-hermosa-guanacaste-costa-rica",
    "/article/playa-hermosa-guanacaste-complete-photography-guide",
    "/article/playa-hermosa-guanacaste-costa-rica-2026-photography-guide",
    // Jaco / Central Pacific Playa Hermosa articles
    "/article/playa-hermosa-jaco-garabito",
    "/article/jaco-beach-playa-hermosa-central-pacific-photography-guide",
  ],
};
