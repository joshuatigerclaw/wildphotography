import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD;

  if (!secret) {
    return NextResponse.json(
      { error: "Admin not configured. Set ADMIN_SECRET env var." },
      { status: 500 }
    );
  }

  if (password !== secret) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
