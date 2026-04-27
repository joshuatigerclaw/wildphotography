import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  console.log("PayPal IPN placeholder received:", body);
  return new NextResponse("OK", { status: 200 });
}
