# Queue Infrastructure Documentation

## Overview

WildPhotography uses Cloudflare Queues for reliable, asynchronous processing of:
- SmugMug metadata import
- Image download and processing
- Typesense search index updates

## Queue Configuration

### wrangler.toml

```toml
# Producers (app enqueues jobs)
[[queues.producers]]
queue = "smugmug-metadata"
binding = "SMUGMUG_METADATA"

[[queues.producers]]
queue = "smugmug-download"
binding = "SMUGMUG_DOWNLOAD"

[[queues.producers]]
queue = "typesense-index"
binding = "TYPESENSE_INDEX"

# Consumers (worker processes jobs)
[[queues.consumers]]
queue = "smugmug-metadata"
max_batch_size = 25
max_batch_timeout = 3

[[queues.consumers]]
queue = "smugmug-download"
max_batch_size = 10
max_batch_timeout = 2

[[queues.consumers]]
queue = "typesense-index"
max_batch_size = 100
max_batch_timeout = 5
```

## Message Formats

### smugmug-metadata

```typescript
interface MetadataMessage {
  type: 'album' | 'image';
  action: 'upsert' | 'delete';
  data: {
    albumId?: string;
    imageId?: string;
    [key: string]: any;
  };
}
```

**Example:**
```json
{
  "type": "image",
  "action": "upsert",
  "data": {
    "imageId": "ABC123",
    "title": "Scarlet Macaw",
    "keywords": ["bird", "macaw", "Costa Rica"]
  }
}
```

### smugmug-download

```typescript
interface DownloadMessage {
  type: 'image';
  imageKey: string;
  sourceUrl: string;
  photoId: number;
}
```

**Example:**
```json
{
  "type": "image",
  "imageKey": "scarlet-macaw-001",
  "sourceUrl": "https://photos.smugmug.com/photos/abc123.jpg",
  "photoId": 16
}
```

### typesense-index

```typescript
interface TypesenseMessage {
  type: 'image';
  action: 'upsert' | 'delete';
  document: PhotoDocument;
}
```

**Example:**
```json
{
  "type": "image",
  "action": "upsert",
  "document": {
    "id": "16",
    "slug": "scarlet-macaw",
    "title": "Scarlet Macaw",
    "keywords": ["scarlet macaw", "macaw", "parrot", "Costa Rica"],
    "location": "Carara National Park, Costa Rica",
    "thumb_url": "https://...",
    "small_url": "https://..."
  }
}
```

## Processing Flow

### 1. Metadata Import
```
SmugMug API → Enqueue metadata → Worker consumer → Neon DB
```

### 2. Image Download
```
Image URL → Enqueue download → Worker → R2 (original) → 
Derivatives → R2 (derivatives) → Neon DB
```

### 3. Search Index Update
```
Photo processed → Enqueue index → Worker → Typesense
```

## Retry Configuration

| Queue | Max Batch | Timeout | Use Case |
|-------|-----------|---------|----------|
| smugmug-metadata | 25 | 3s | Bulk metadata sync |
| smugmug-download | 10 | 2s | Image processing (slower) |
| typesense-index | 100 | 5s | Fast indexing |

## Error Handling

- Each message is logged on receipt, start, success, and failure
- Failed messages are retried automatically
- No secrets are logged (only IDs and keys)
- Message payloads are kept small (no raw images or large blobs)

## Testing

```bash
# Deploy worker
npx wrangler deploy

# Send test messages
curl "https://wildphotography-media.josh-ec6.workers.dev/api/v1/queue/test?queue=metadata"
curl "https://wildphotography-media.josh-ec6.workers.dev/api/v1/queue/test?queue=download"
curl "https://wildphotography-media.josh-ec6.workers.dev/api/v1/queue/test?queue=typesense"

# View logs
npx wrangler tail
```

## Code Location

- Worker + Queue handlers: `src/worker.ts`
- Image processor: `packages/image-processor/src/process.ts`
- Test script: `scripts/test-queues.js`
