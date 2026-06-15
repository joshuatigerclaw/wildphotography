import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';

interface VisitEvent {
  photoId: number;
  ipHash: string;
  day: string;       // YYYY-MM-DD
  queuedAt: number;  // unix ms timestamp
}

/**
 * Visit tracking — zero Neon calls in the hot path.
 * 
 * Architecture:
 * 1. /api/visit returns 200 immediately (bot check only)
 * 2. Event is serialized and sent to Cloudflare Queue `do-queue`
 * 3. Queue consumer (scripts/flush-visit-queue.js) runs every 5 min
 *    and batch-upserts events into photo_visit_daily
 * 4. views_count rollup: scripts/rollup-photo-view-counts.js (every 6h)
 * 
 * Neon is no longer called from the visit hot path at all.
 */
export async function POST(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';

  // ── Bot / non-user detection ─────────────────────────────
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
  const today = new Date().toISOString().slice(0, 10);

  // ── Send to queue (non-blocking, after response) ───────
  after(() => {
    sendToQueue(pid, ipHash, today).catch((err: Error) => {
      console.error('[visit] Queue send error:', err.message);
    });
  });

  return NextResponse.json({ success: true, counted: true });
}

async function sendToQueue(photoId: number, ipHash: string, day: string) {
  // Access the Cloudflare Queue binding — available in Cloudflare Workers runtime
  // @ts-expect-error — env types not available at build time for Next.js route handlers
  const queue: import('@cloudflare/workers-types').Queue.ProducerAdapter = 
    // @ts-expect-error
    globalThis.ThisWorker?.env?.DOQueue;

  if (!queue) {
    // Fallback: queue not available, skip silently (visit not critical path)
    console.warn('[visit] DOQueue binding not available, skipping');
    return;
  }

  const event: VisitEvent = {
    photoId,
    ipHash,
    day,
    queuedAt: Date.now(),
  };

  // sendBatch is the Cloudflare Queue producer API
  await queue.sendBatch([{ body: JSON.stringify(event) }]);
}

/** Fast FNV-style hash for IP anonymization (not reversible) */
function hashIP(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  let h = 2166136261;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16);
}
