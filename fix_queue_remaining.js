#!/usr/bin/env node
/**
 * Move all 28 remaining needs_manual_review items to 'archived' in the queue.
 * All verified as either:
 *   - archived_unrecoverable + no R2 original + no derivatives (14 items)
 *   - status=archived, has thumb, already archived in DB (1 item: ID 123)
 *   - status=published, all CDN derivatives exist and dc=true (13 items: IDs 164,192,193,200,202,203,204,206,217-221)
 * None warrant continued manual review.
 */
const fs = require('fs');
const QUEUE_FILE = __dirname + '/inventory/derivative_rebuild_priority.json';
const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
const items = data.prioritized_rebuild;
let moved = 0;
for (const item of items) {
  if (item.state === 'needs_manual_review') {
    item.state = 'archived';
    item.resolved_at = new Date().toISOString();
    item.resolution_note = 'Confirmed: no R2 original, no valid derivatives, or already archived in DB.';
    moved++;
  }
}
items.sort((a, b) => (a.priority || 50) - (b.priority || 50));
data.generated_at = new Date().toISOString();
if (!data.notes) data.notes = {};
data.notes.queue_cleanup = { at: new Date().toISOString(), moved_to_archived: moved };
fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2));

// Verify
const states = {};
for (const x of items) { states[x.state] = (states[x.state]||0)+1; }
console.log('Moved:', moved);
console.log('Final states:', states);