import { NextResponse } from 'next/server';

// GET /api/v1/health
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'wildphotography-api',
  });
}
