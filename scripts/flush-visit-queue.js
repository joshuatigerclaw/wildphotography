#!/usr/bin/env node
/**
 * scripts/flush-visit-queue.js
 *
 * Cloudflare Queue consumer for visit events.
 * Reads batched VisitEvent messages from `do-queue` and upserts into photo_visit_daily.
 *
 * Architecture:
 *   /api/visit → sendToQueue() → do-queue (Cloudflare Queue)
 *   flush-visit-queue.js (this script) ← do-queue consumer
 *   → batch upsert into photo_visit_daily (Neon)
 *
 * Usage:
 *   node scripts/flush-visit-queue.js --dry-run
 *
 * Queue consumer registration (wrangler.toml):
 *   [[queues.consumers]]
 *     queue = "do-queue"
 *     script = "scripts/flush-visit-queue.js"
 *
 * Advisory lock key: 12343 (different from health-check=12341, reconcile=12340, rollup=12342)
 */

'use strict';

const { Client } = require('pg');

const NEON_DB = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const ADVISORY_LOCK_KEY = 12343n;

const BATCH_SIZE = 500;

// ── Args ──────────────────────────────────────────────────────────────────────

const isDryRun = process.argv.includes('--dry-run');

// ── VisitEvent shape (matches /api/visit/route.ts) ────────────────────────────

/**
 * @typedef {Object} VisitEvent
 * @property {number} photoId
 * @property {string} ipHash
 * @property {string} day        YYYY-MM-DD
 * @property {number} queuedAt  unix ms timestamp
 */

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  // Read messages from stdin (Cloudflare Queue format)
  const messages = await readQueueMessages();

  if (!messages.length) {
    console.log('No messages to process');
    return;
  }

  console.log(`Processing ${messages.length} visit events...`);

  if (isDryRun) {
    messages.slice(0, 5).forEach(m => {
      const event = typeof m === 'string' ? JSON.parse(m) : m;
      console.log(`  DRY RUN: photoId=${event.photoId} day=${event.day} ipHash=${event.ipHash}`);
    });
    return;
  }

  // Group by (photo_id, day)
  const grouped = new Map();
  for (const msg of messages) {
    const event = typeof msg === 'string' ? JSON.parse(msg) : msg;
    const key = `${event.photoId}::${event.day}`;
    if (!grouped.has(key)) {
      grouped.set(key, { photoId: event.photoId, day: event.day, count: 0 });
    }
    grouped.get(key).count += 1;
  }

  const client = new Client(NEON_DB);
  await client.connect();

  try {
    // Advisory lock to prevent overlapping runs
    const lockRes = await client.query(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [ADVISORY_LOCK_KEY]
    );
    if (!lockRes.rows[0]?.acquired) {
      console.log('⚠️  Could not acquire lock — another instance running. Exiting.');
      return;
    }
    console.log('🔒 Advisory lock acquired');

    // Batch upsert
    const entries = Array.from(grouped.values());
    let upserted = 0;
    let errors = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const sets = batch.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`);
      const values = batch.flatMap(r => [r.photoId, r.day]);

      const updateSets = batch.map((_, idx) =>
        `($${idx * 2 + 1}, $${idx * 2 + 2}, $${batch.length * 2 + idx + 1})`
      );
      const updateValues = batch.flatMap(r => [r.photoId, r.day, r.count]);

      const res = await client.query(`
        INSERT INTO photo_visit_daily (photo_id, day, visit_count)
        VALUES ${batch.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2}, $${batch.length * 2 + idx + 1})`).join(', ')}
        ON CONFLICT (photo_id, day)
        DO UPDATE SET visit_count = photo_visit_daily.visit_count + EXCLUDED.visit_count`,
        [...batch.flatMap(r => [r.photoId, r.day]), ...batch.map(r => r.count)]
      );

      upserted += res.rowCount || 0;
    }

    console.log(`✅ Upserted ${upserted} photo-day records from ${messages.length} events`);

  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    console.log('🔓 Advisory lock released');
    await client.end();
  }
}

// ── Read from stdin (Cloudflare Queue format) ──────────────────────────────────

async function readQueueMessages() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  if (!chunks.length) return [];

  const input = JSON.parse(Buffer.concat(chunks).toString());

  // Cloudflare Queue messages come as { messages: [{body: string}] }
  const messages = Array.isArray(input) ? input : (input.messages || []);
  return messages.map(m => {
    if (typeof m === 'string') return m;
    if (m.body) return typeof m.body === 'string' ? m.body : JSON.stringify(m.body);
    return JSON.stringify(m);
  });
}

// ── Run ────────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
