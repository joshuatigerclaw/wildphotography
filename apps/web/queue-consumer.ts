/**
 * apps/web/queue-consumer.ts
 *
 * Cloudflare Queue consumer for visit events.
 * Consumes from `do-queue` and batch-upserts into photo_visit_daily.
 *
 * Architecture:
 *   /api/visit → DOQueue.send() → do-queue
 *   queue-consumer.ts ← do-queue (Cloudflare Queue consumer)
 *   → batch upsert into photo_visit_daily (Neon)
 *
 * Deployment:
 *   Add to wrangler.toml:
 *     [[queues.consumers]]
 *       queue = "do-queue"
 *       script = "queue-consumer.ts"
 *       max_batch_size = 100
 *       max_batch_timeout = 30
 */

import { neon } from '@neondatabase/serverless';

interface VisitMessage {
  photoId: number;
  ipHash: string;
  timestamp: number;
}

// ── Minimal Cloudflare Workers queue types ──────────────────────────────────

interface QueueMessage<T> {
  body: T;
  timestamp: number;
  id: string;
  retry(): void;
  ack(): void;
}

interface QueueBatch<T> {
  messages: QueueMessage<T>[];
}

interface Env {
  DATABASE_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// ── Types end ────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

export default {
  async queue(
    batch: QueueBatch<VisitMessage>,
    _env: Env,
    _ctx: ExecutionContext
  ) {
    const messages = batch.messages;
    if (!messages.length) return;

    console.log(`[queue-consumer] Batch size: ${messages.length}`);

    // ── Validate and parse ─────────────────────────────────────────────────
    const valid: { photoId: number; day: string }[] = [];
    let invalidCount = 0;

    for (const msg of messages) {
      try {
        const body = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
        if (
          typeof body?.photoId !== 'number' ||
          !Number.isFinite(body.photoId) ||
          body.photoId <= 0
        ) {
          invalidCount++;
          msg.retry();
          continue;
        }
        // Compute UTC date string from timestamp
        const dayStr = new Date(body.timestamp).toISOString().slice(0, 10);
        valid.push({ photoId: Math.floor(body.photoId), day: dayStr });
      } catch {
        invalidCount++;
        msg.retry();
      }
    }

    if (!valid.length) {
      console.log(`[queue-consumer] No valid messages (invalid: ${invalidCount})`);
      return;
    }

    // ── Aggregate by (photo_id, day) ─────────────────────────────────────
    const grouped = new Map<string, { photoId: number; day: string; count: number }>();
    for (const v of valid) {
      const key = `${v.photoId}::${v.day}`;
      if (!grouped.has(key)) {
        grouped.set(key, { photoId: v.photoId, day: v.day, count: 0 });
      }
      grouped.get(key)!.count++;
    }

    const entries = Array.from(grouped.values());
    console.log(
      `[queue-consumer] ${messages.length} messages → ${entries.length} aggregate groups (invalid: ${invalidCount})`
    );

    // ── Batch upsert to Neon ───────────────────────────────────────────────
    const sql = neon(DATABASE_URL);
    const BATCH_SIZE = 100;
    let upserted = 0;
    let errors = 0;

    try {
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const photoIds = batch.map(r => r.photoId);
        const visitCounts = batch.map(r => r.count);
        const days = batch.map(r => r.day);

        await sql`
          INSERT INTO photo_visit_daily (photo_id, day, source, visit_count, last_seen_at)
          SELECT photo_id, day, 'web', visit_count, NOW()
          FROM UNNEST(${photoIds}::int[], ${days}, ${visitCounts}::int[])
            AS t(photo_id, day, visit_count)
          ON CONFLICT (photo_id, day)
          DO UPDATE SET
            visit_count = photo_visit_daily.visit_count + EXCLUDED.visit_count,
            last_seen_at = NOW()
        `;
        upserted += batch.length;
      }
      console.log(`[queue-consumer] ✅ Upserted ${upserted} aggregate rows`);
    } catch (err) {
      errors++;
      console.error('[queue-consumer] ❌ Neon upsert error:', err instanceof Error ? err.message : err);
      // Rethrow so Cloudflare Queue retries the batch
      throw err;
    }
  },
};
