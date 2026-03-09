/**
 * Queue Test Client
 * 
 * Tests queue functionality locally using Cloudflare's queue testing utilities.
 * 
 * Note: Requires deployed Worker with queue bindings to actually test.
 * 
 * Usage:
 * 1. Deploy worker: npx wrangler deploy
 * 2. Run tests: node scripts/test-queues.js
 */

const TEST_QUEUES = [
  {
    name: 'smugmug-metadata',
    messages: [
      { type: 'album', action: 'upsert', data: { albumId: 'test-album-1', name: 'Test Album' } },
      { type: 'image', action: 'upsert', data: { imageId: 'test-image-1', title: 'Test Image' } },
      { type: 'album', action: 'delete', data: { albumId: 'test-album-delete' } },
    ]
  },
  {
    name: 'smugmug-download',
    messages: [
      { type: 'image', imageKey: 'test-image-1', sourceUrl: 'https://example.com/test.jpg', photoId: 1 },
      { type: 'image', imageKey: 'test-image-2', sourceUrl: 'https://example.com/test2.jpg', photoId: 2 },
    ]
  },
  {
    name: 'typesense-index',
    messages: [
      { type: 'image', action: 'upsert', document: { id: '1', slug: 'test-image', title: 'Test Image' } },
      { type: 'image', action: 'delete', document: { id: '2', slug: 'test-deleted' } },
    ]
  }
];

console.log('=== Queue Test Configuration ===\n');
console.log('Queues configured:');
TEST_QUEUES.forEach(q => {
  console.log(`  - ${q.name}: ${q.messages.length} test messages`);
});

console.log('\nTo test:');
console.log('1. Deploy worker: npx wrangler deploy');
console.log('2. Send test messages via HTTP:');
console.log('   curl "https://your-worker.workers.dev/api/v1/queue/test?queue=metadata"');
console.log('   curl "https://your-worker.workers.dev/api/v1/queue/test?queue=download"');
console.log('   curl "https://your-worker.workers.dev/api/v1/queue/test?queue=typesense"');
console.log('\n3. Check logs: wrangler tail');

console.log('\n=== Message Formats ===\n');

console.log('smugmug-metadata:');
console.log(JSON.stringify(TEST_QUEUES[0].messages[0], null, 2));

console.log('\nsmugmug-download:');
console.log(JSON.stringify(TEST_QUEUES[1].messages[0], null, 2));

console.log('\ntypesense-index:');
console.log(JSON.stringify(TEST_QUEUES[2].messages[0], null, 2));

console.log('\n=== Retry Configuration ===\n');
console.log('metadata consumer: max_batch_size=25, max_batch_timeout=3s');
console.log('download consumer: max_batch_size=10, max_batch_timeout=2s');
console.log('typesense consumer: max_batch_size=100, max_batch_timeout=5s');

console.log('\n=== Expected Flow ===\n');
console.log('1. SmugMug API → queue message → Worker → Neon DB');
console.log('2. Image URL → queue message → Worker → R2 → Derivatives → Neon');
console.log('3. Photo update → queue message → Worker → Typesense');

console.log('\n✅ Queue infrastructure documented!');
