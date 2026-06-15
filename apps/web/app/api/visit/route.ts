import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// Bot detection — common crawler user agents
const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatcms/i, /ahrefs/i, /semrush/i, /petalbot/i, /applebot/i,
  /meta-externalagent/i, /GPTBot/i, /CCBot/i, /anthropic-ai/i,
  /cloudflare-network/i, /pingdom/i, /speedcurve/i, /newrelic/i,
  /python-requests/i, /node-fetch/i, /axios/i, /got/i, /undici/i,
  /aiohttp/i, /httpx/i, /java\//i, /go-http-client/i, /ruby/i,
  /phantomjs/i, /headless/i, /puppeteer/i, /selenium/i, /playwright/i,
  /wget/i, /httpie/i, /rest-client/i,
];

function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BOT_PATTERNS.some(pattern => pattern.test(ua));
}

export async function POST(request: NextRequest) {
  // ── Parse body safely ───────────────────────────────────────────────
  let photoId: string | undefined;
  let slug: string | undefined;
  let source = 'web';

  try {
    const body = await request.json();
    photoId = body?.photoId != null ? String(body.photoId) : undefined;
    slug = body?.slug != null ? String(body.slug) : undefined;
    source = body?.source && typeof body.source === 'string' ? body.source : 'web';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Validate required fields ──────────────────────────────────────────
  if (!photoId || !slug) {
    return NextResponse.json({ error: 'Missing photoId or slug' }, { status: 400 });
  }

  // ── Bot detection ────────────────────────────────────────────────────
  const userAgent = request.headers.get('user-agent') ?? null;
  if (isBotUserAgent(userAgent)) {
    return NextResponse.json({
      success: true,
      counted: false,
      reason: 'bot',
      queued: false,
    });
  }

  // ── Queue send ───────────────────────────────────────────────────────
  // Cloudflare bindings are set on globalThis.__env by worker.js patch
  // (scripts/patch-env.mjs — run after each OpenNext build)
  let queued = false;
  const cfEnv = (globalThis as any).__env;
  const visitQueue = cfEnv?.VISIT_QUEUE ?? cfEnv?.DOQueue;

  if (visitQueue && typeof visitQueue.send === 'function') {
    try {
      await visitQueue.send({
        type: 'visit_event',
        photoId,
        slug,
        source,
        userAgent,
        referrer: request.headers.get('referer') ?? null,
        timestamp: new Date().toISOString(),
      }, { contentType: 'json' });
      queued = true;
    } catch (e: any) {
      console.warn('[visit] Queue send failed:', e?.message ?? e);
    }
  }

  // ── Write to photo_visit_daily aggregate ─────────────────────────────
  let counted = false;
  try {
    const sql = neon(DATABASE_URL);
    const today = new Date().toISOString().split('T')[0];
    await sql`
      INSERT INTO photo_visit_daily (photo_id, day, source, visit_count)
      VALUES (${parseInt(photoId)}, ${today}, ${source}, 1)
      ON CONFLICT (photo_id, day)
      DO UPDATE SET
        visit_count = photo_visit_daily.visit_count + 1,
        last_seen_at = NOW()
    `;
    counted = true;
  } catch (e: any) {
    // Visit tracking failure is non-fatal — return 200
    console.error('[visit] DB upsert failed:', e?.message ?? e);
  }

  return NextResponse.json({ success: true, counted, queued });
}