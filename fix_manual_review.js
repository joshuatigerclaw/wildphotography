#!/usr/bin/env node
/**
 * Fix derivative_rebuild_priority.json — resolves false-positive manual_review entries.
 *
 * 65 manual_review entries breakdown:
 *   36x published + derivatives_complete=true + thumb/small/medium exist  → FALSE POSITIVE → move to "new"
 *   28x archived_unrecoverable + no derivatives                          → CORRECT → keep as needs_manual_review
 *    1x archived + thumb exists, small/medium missing                    → partial → keep as needs_manual_review
 *
 * After this fix, only 29 remain in needs_manual_review (all genuinely unrecoverable/partial).
 */

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'inventory', 'derivative_rebuild_priority.json');
const backupFile = QUEUE_FILE + '.backup_before_manual_review_fix.json';

const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
const items = data.prioritized_rebuild;

const beforeCount = items.length;
const beforeManualReview = items.filter(x => x.state === 'needs_manual_review').length;

const FALSE_POSITIVE_IDS = new Set([
  // 36 published + derivatives_complete=true with all CDN URLs confirmed valid
  124,125,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,
  158,159,160,175,176,177
]);

let movedToNew = 0;
let kept = 0;

for (const item of items) {
  if (item.state === 'needs_manual_review') {
    if (FALSE_POSITIVE_IDS.has(item.id)) {
      item.state = 'new';
      item.reason = 'false_positive_resolved';
      item.priority = 99; // low priority (already has derivs)
      movedToNew++;
    } else {
      // Keep in needs_manual_review (28 archived_unrecoverable + 1 archived with partial derivs)
      kept++;
    }
  }
}

// Sort back by priority
items.sort((a, b) => (a.priority || 50) - (b.priority || 50));

// Update metadata
data.generated_at = new Date().toISOString();
if (!data.notes) data.notes = {};
data.notes.manual_review_fix = {
  at: new Date().toISOString(),
  moved_to_new: movedToNew,
  kept_in_manual_review: kept,
  reason: '36 false positives: published+derivs_complete with valid CDN URLs. 29 kept: archived_unrecoverable (no derivs) or archived with partial.',
};

fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2));

console.log('=== Manual Review Fix ===');
console.log(`Total queue items: ${beforeCount}`);
console.log(`Before: needs_manual_review=${beforeManualReview}`);
console.log(`Moved to new (false positives): ${movedToNew}`);
console.log(`Kept in needs_manual_review: ${kept}`);
console.log(`Backup: ${backupFile}`);
console.log(`Updated: ${QUEUE_FILE}`);

// Verify
const afterManualReview = items.filter(x => x.state === 'needs_manual_review').length;
console.log(`\nAfter: needs_manual_review=${afterManualReview} (expected 29)`);