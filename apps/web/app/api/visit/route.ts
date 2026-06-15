import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

export const dynamic = 'force-dynamic';

/**
 * Visit tracking.
 *
 * Writes directly to photo_visit_daily (upsert) — no per-request photo_views update.
 * photo_visit_daily columns: photo_id, day, source, visit_count, last_seen_at, created_at, updated_at
 * No ip_address column in photo_visit_daily (separate table: photo_visits for detailed logs).
 *
 * Bot detection + IP hash (FNV, anonymized).
 *
 * Future: switch to queue producer once consumer is deployed, for batched writes.
 * Currently: direct write (single UPSERT, fast path since no FK on photo_visit_daily).
 */

function hashIP(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  let h = 2166136261;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16);
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';

  // ── Bot / non-user detection ─────────────────────────────────────────────
  const ua = userAgent.toLowerCase();
  if (/bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternal|twitterbot|applebot|anthropic|claudebot|perplexity|imagesift|ccbot|amazonbot|semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot|linkedinbot|skypeuripreview|whatsapp|telegram/i.test(ua)) {
    return NextResponse.json({ success: true, counted: false, reason: 'bot' });
  }

  let body: { photoId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { photoId } = body;
  if (!photoId) {
    return NextResponse.json({ error: 'Missing photoId' }, { status: 400 });
  }

  const pid = parseInt(photoId);
  if (isNaN(pid)) {
    return NextResponse.json({ error: 'Invalid photoId' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const ipHash = hashIP(ip);

  // ── Try queue send first (non-blocking) ─────────────────────────────────
  // TODO: once queue consumer is deployed, switch to queue-only path
  try {
    const env = (request as any).env;
    if (env?.DOQueue) {
      await env.DOQueue.send({
        photoId: pid,
        ipHash,
        timestamp: Date.now(),
      }).catch(() => {}); // non-critical, fall through to direct write
    }
  } catch {
    // queue unavailable — fall through to direct write
  }

  // ── Direct upsert to photo_visit_daily ─────────────────────────────────
  // photo_visit_daily schema: photo_id, day, source, visit_count, last_seen_at, created_at, updated_at
  // No FK on photo_visit_daily — inserts always succeed for valid photo IDs
  const sql = neon(DATABASE_URL);

  try {
    await sql`
      INSERT INTO photo_visit_daily (photo_id, day, source, visit_count, last_seen_at)
      VALUES (${pid}, CURRENT_DATE, 'web', 1, NOW())
      ON CONFLICT (photo_id, day)
      DO UPDATE SET
        visit_count = photo_visit_daily.visit_count + 1,
        last_seen_at = NOW()
    `;
    return NextResponse.json({ success: true, counted: true });
  } catch (err) {
    // photo_visit_daily has no FK, so the only failure is connection/timeout
    console.error('[visit] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
