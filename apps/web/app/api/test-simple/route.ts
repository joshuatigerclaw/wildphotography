import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'test-simple works',
    url: request.nextUrl.pathname,
    timestamp: new Date().toISOString()
  });
}