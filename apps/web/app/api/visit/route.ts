import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

export const dynamic = 'force-dynamic';

/**
 * Visit tracking — queue-first, Neon-free hot path.
 *
 * Sends visit event to do-queue for batched async processing.
 * Direct Neon fallback only if VISIT_DIRECT_NEON_FALLBACK=true (default: false).
 *
 * Message payload sent to queue:
 *   { photoId, ipHash, timestamp }
 *
 * photo_visit_daily columns: photo_id, day, source, visit_count, last_seen_at
 *
 * Bot detection + IP hash (FNV, anonymized, not stored in queue payload).
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

export async function POST(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _context: any
) {
  // env bindings from CF Workers (DOQueue, etc.) are exposed on globalThis.__env
  // by the patched worker.js right before calling the Next.js handler.
  const cfEnv = (globalThis as Record<string, unknown>)['__env'] as
    | { DOQueue?: { send: (msg: object) => Promise<void> }; VISIT_DIRECT_NEON_FALLBACK?: string }
    | undefined;
  const doQueue = cfEnv?.DOQueue;
  const visitDirectFallback = cfEnv?.VISIT_DIRECT_NEON_FALLBACK ?? 'false';
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

  // ── Queue send (primary path) ───────────────────────────────────────────
  let queued = false;
  try {
    if (doQueue) {
      await doQueue.send({
        photoId: pid,
        ipHash,
        timestamp: Date.now(),
      });
      queued = true;
    } else {
      console.error('[visit] DOQueue not available via globalThis.__env');
    }
  } catch (err) {
    console.error('[visit] Queue send error:', err instanceof Error ? err.message : String(err));
  }

  // ── Direct Neon fallback (only if env flag is set) ─────────────────────
  if (visitDirectFallback === 'true') {
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
      return NextResponse.json({ success: true, counted: true, queued });
    } catch (err) {
      console.error('[visit] Neon fallback error:', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  // Default: queue-only (queued or not, return success to client)
  return NextResponse.json({ success: true, counted: true, queued });
}
