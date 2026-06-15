/**
 * Visit Queue Consumer Worker
 * Consumes visit_event messages from visit-queue and upserts into photo_visit_daily.
 * Unhandled message types are logged and acknowledged (pass-through for cache revalidation).
 */

interface VisitEvent {
  type: 'visit_event';
  photoId: string;
  slug: string;
  source: string;
  userAgent: string | null;
  referrer: string | null;
  timestamp: string;
}

interface Env {
  DATABASE_URL: string;
}

export default {
  async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    const visitEvents: VisitEvent[] = [];

    for (const msg of batch.messages) {
      try {
        const body = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
        if (body?.type === 'visit_event') {
          visitEvents.push(body as VisitEvent);
        } else {
          // Non-visit message — log and acknowledge (OpenNext cache revalidation messages)
          console.log('[visit-consumer] Non-visit message received:', JSON.stringify(body).slice(0, 200));
        }
      } catch (e: any) {
        console.warn('[visit-consumer] Could not parse message body:', e?.message ?? e);
      }
    }

    if (visitEvents.length > 0) {
      await processVisitEvents(visitEvents, env);
    }
  },
};

async function processVisitEvents(events: VisitEvent[], env: Env): Promise<void> {
  if (events.length === 0) return;

  const DATABASE_URL = env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DATABASE_URL);

  // Group by photoId + date
  const byPhotoAndDate = new Map<string, { photoId: string; date: string; count: number }>();
  for (const evt of events) {
    const date = evt.timestamp.split('T')[0];
    const key = `${evt.photoId}::${date}`;
    const existing = byPhotoAndDate.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byPhotoAndDate.set(key, { photoId: evt.photoId, date, count: 1 });
    }
  }

  // Upsert each aggregate
  const results = await Promise.allSettled(
    [...byPhotoAndDate.values()].map(({ photoId, date, count }) =>
      sql`
        INSERT INTO photo_visit_daily (photo_id, day, source, visit_count)
        VALUES (${parseInt(photoId)}, ${date}, 'web', ${count})
        ON CONFLICT (photo_id, day)
        DO UPDATE SET
          visit_count = photo_visit_daily.visit_count + EXCLUDED.visit_count,
          last_seen_at = NOW()
      `
    )
  );

  let success = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') success++;
    else {
      failed++;
      console.error('[visit-consumer] Upsert failed:', r.reason?.message ?? r.reason);
    }
  }

  console.log(`[visit-consumer] ${events.length} events → ${byPhotoAndDate.size} aggregates: ${success} ok, ${failed} failed`);
}
