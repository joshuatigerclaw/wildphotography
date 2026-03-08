/**
 * Wildphotography Media Worker with Queue Support
 * 
 * Handles:
 * - Media serving (derivatives only)
 * - Queue consumers for SmugMug import pipeline
 * 
 * Queue Messages:
 * - smugmug-metadata: { type: 'album' | 'image', action: 'upsert' | 'delete', data: {...} }
 * - smugmug-download: { type: 'image', imageKey: string, sourceUrl: string }
 * - typesense-index: { type: 'image', document: {...} }
 */

export interface Env {
  PHOTO_BUCKET: R2Bucket;
  SMUGMUG_METADATA: Queue;
  SMUGMUG_DOWNLOAD: Queue;
  TYPESENSE_INDEX: Queue;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // Health check
    if (path === 'api/v1/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
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
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  // Queue handlers
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const queueName = batch.queue;
    
    for (const message of batch.messages) {
      const body = message.body as any;
      
      try {
        switch (queueName) {
          case 'smugmug-metadata':
            await handleMetadataMessage(body, env);
            break;
          case 'smugmug-download':
            await handleDownloadMessage(body, env);
            break;
          case 'typesense-index':
            await handleIndexMessage(body, env);
            break;
        }
        message.ack();
      } catch (error) {
        console.error(`Queue ${queueName} error:`, error);
        // Retry with backoff
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function handleMetadataMessage(msg: any, env: Env) {
  console.log('[metadata] Processing:', msg.type, msg.action);
  // TODO: Implement metadata upsert to Neon
}

async function handleDownloadMessage(msg: any, env: Env) {
  console.log('[download] Processing:', msg.imageKey);
  // TODO: Implement image download to R2
}

async function handleIndexMessage(msg: any, env: Env) {
  console.log('[index] Processing:', msg.document?.slug);
  // TODO: Implement Typesense indexing
}
