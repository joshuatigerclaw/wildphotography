import { NextRequest, NextResponse } from "next/server";

// Protect all /admin/* routes except /admin itself (which shows login)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect /admin → /admin/dashboard
  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin"],
};
