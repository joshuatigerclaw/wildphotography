/**
 * Wildphotography Queue Consumers
 * 
 * Handles:
 * - smugmug-metadata: Album/image metadata import
 * - smugmug-download: Image download and processing
 * - typesense-index: Search index updates
 * 
 * Message Formats:
 * 
 * smugmug-metadata:
 *   { type: 'album', action: 'upsert'|'delete', data: { albumId, ... } }
 *   { type: 'image', action: 'upsert'|'delete', data: { imageId, ... } }
 * 
 * smugmug-download:
 *   { type: 'image', imageKey: string, sourceUrl: string, photoId: number }
 * 
 * typesense-index:
 *   { type: 'image', action: 'upsert'|'delete', document: { ... } }
 */

export interface Env {
  PHOTO_BUCKET: R2Bucket;
  SMUGMUG_METADATA: Queue;
  SMUGMUG_DOWNLOAD: Queue;
  TYPESENSE_INDEX: Queue;
}

// ============================================================
// Message Types
// ============================================================

export interface MetadataMessage {
  type: 'album' | 'image';
  action: 'upsert' | 'delete';
  data: Record<string, any>;
}

export interface DownloadMessage {
  type: 'image';
  imageKey: string;
  sourceUrl: string;
  photoId: number;
}

export interface TypesenseMessage {
  type: 'image';
  action: 'upsert' | 'delete';
  document: Record<string, any>;
}

export type QueueMessage = MetadataMessage | DownloadMessage | TypesenseMessage;

// ============================================================
// Queue Handlers
// ============================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // Health check
    if (path === 'api/v1/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // Admin: Enqueue test message
    if (path === 'api/v1/queue/test') {
      const queueName = url.searchParams.get('queue') || 'smugmug-metadata';
      const message = {
        type: 'test',
        timestamp: Date.now(),
        message: 'Test message from queue API',
      };

      let queue;
      switch (queueName) {
        case 'metadata':
          queue = env.SMUGMUG_METADATA;
          break;
        case 'download':
          queue = env.SMUGMUG_DOWNLOAD;
          break;
        case 'typesense':
          queue = env.TYPESENSE_INDEX;
          break;
        default:
          return Response.json({ error: 'Unknown queue' }, { status: 400 });
      }

      await queue.send(message);
      return Response.json({ success: true, queue: queueName, message });
    }

    // Block originals
    if (path.startsWith('originals/')) {
      return new Response('Forbidden - originals are private', { status: 403 });
    }

    // Block downloads
    if (path.startsWith('downloads/')) {
      return new Response('Downloads require authentication', { status: 403 });
    }

    // Serve derivatives
    if (path.startsWith('derivatives/')) {
      try {
        const object = await env.PHOTO_BUCKET.get(path);
        if (!object) return new Response('Not Found', { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        
        return new Response(object.body, { headers });
      } catch (error) {
        console.error('[worker] Error serving derivative:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  // ============================================================
  // Queue Consumers
  // ============================================================

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const queueName = batch.queue;
    
    console.log(`[queue] Received ${batch.messages.length} messages from ${queueName}`);
    
    for (const message of batch.messages) {
      const body = message.body as QueueMessage;
      
      console.log(`[queue] Processing:`, {
        type: body.type,
        timestamp: Date.now(),
        attempts: message.workspaceId || 'unknown',
      });
      
      try {
        switch (queueName) {
          case 'smugmug-metadata':
            await handleMetadataMessage(body as MetadataMessage, env);
            break;
          case 'smugmug-download':
            await handleDownloadMessage(body as DownloadMessage, env);
            break;
          case 'typesense-index':
            await handleTypesenseMessage(body as TypesenseMessage, env);
            break;
          default:
            console.warn(`[queue] Unknown queue: ${queueName}`);
        }
        
        message.ack();
        console.log(`[queue] Success:`, { type: body.type });
        
      } catch (error) {
        console.error(`[queue] Error:`, {
          type: body.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        // Retry with backoff
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env>;

// ============================================================
// Metadata Queue Handler
// ============================================================

async function handleMetadataMessage(msg: MetadataMessage, env: Env): Promise<void> {
  console.log(`[metadata] ${msg.action} ${msg.type}:`, msg.data);
  
  // TODO: Implement actual metadata sync to Neon
  // For now, just log
  
  switch (msg.type) {
    case 'album':
      if (msg.action === 'upsert') {
        console.log(`[metadata] Would upsert album:`, msg.data.albumId);
      } else if (msg.action === 'delete') {
        console.log(`[metadata] Would delete album:`, msg.data.albumId);
      }
      break;
      
    case 'image':
      if (msg.action === 'upsert') {
        console.log(`[metadata] Would upsert image:`, msg.data.imageId);
      } else if (msg.action === 'delete') {
        console.log(`[metadata] Would delete image:`, msg.data.imageId);
      }
      break;
  }
}

// ============================================================
// Download Queue Handler
// ============================================================

async function handleDownloadMessage(msg: DownloadMessage, env: Env): Promise<void> {
  console.log(`[download] Processing:`, {
    imageKey: msg.imageKey,
    photoId: msg.photoId,
  });
  
  // TODO: Implement actual download + processing
  // 1. Download from source URL
  // 2. Upload original to R2
  // 3. Generate derivatives
  // 4. Update Neon DB
  
  console.log(`[download] Would download:`, msg.sourceUrl);
  console.log(`[download] Would process with photoId:`, msg.photoId);
}

// ============================================================
// Typesense Index Queue Handler
// ============================================================

async function handleTypesenseMessage(msg: TypesenseMessage, env: Env): Promise<void> {
  console.log(`[typesense] ${msg.action}:`, msg.document?.slug || 'unknown');
  
  // TODO: Implement actual Typesense indexing
  // For now, just log
  
  if (msg.action === 'upsert') {
    console.log(`[typesense] Would index:`, msg.document?.slug);
  } else if (msg.action === 'delete') {
    console.log(`[typesense] Would remove:`, msg.document?.slug || msg.document?.id);
  }
}
