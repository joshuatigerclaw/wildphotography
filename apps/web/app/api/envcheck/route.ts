import { NextResponse } from 'next/server';

// This endpoint runs INSIDE the Next.js handler in the worker
// It can access process.env but NOT the env parameter from the fetch handler
export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (len=' + process.env.DATABASE_URL.length + ')' : 'MISSING',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'MISSING',
    NEXTJS_ENV: process.env.NEXTJS_ENV || 'MISSING',
    OPEN_NEXT_ORIGIN: process.env.OPEN_NEXT_ORIGIN || 'MISSING',
    __NEXT_PRIVATE_ORIGIN: process.env.__NEXT_PRIVATE_ORIGIN || 'MISSING',
    ASSETS: process.env.ASSETS ? 'SET' : 'MISSING',
    R2: process.env.NEXT_INC_CACHE_R2_BUCKET ? 'SET' : 'MISSING',
    keys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('PASSWORD') && !k.includes('TOKEN')),
  });
}
