/**
 * Wildphotography Media Worker
 * 
 * Serves media from R2 bucket with proper cache headers
 * 
 * Access Rules:
 * - derivatives/*  : PUBLIC - served with long-lived cache
 * - downloads/*   : PROTECTED - returns 403 (requires signed URL)
 * - originals/*    : BLOCKED - returns 403
 * 
 * TEMPORARY ENDPOINT: https://wildphotography-media.josh-ec6.workers.dev
 * PRODUCTION: https://media.wildphotography.com (pending custom domain)
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // Remove leading slash

    // BLOCK: originals/ - never accessible
    if (path.startsWith('originals/')) {
      return new Response('Forbidden - originals are private', { status: 403 });
    }

    // BLOCK: downloads/ - requires signed URL (not implemented yet)
    if (path.startsWith('downloads/')) {
      return new Response('Downloads require authentication', { status: 403 });
    }

    // ALLOW: derivatives/* - public with cache headers
    if (path.startsWith('derivatives/')) {
      try {
        const object = await env.PHOTO_BUCKET.get(path);
        
        if (!object) {
          return new Response('Not Found', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        
        // Long-lived immutable cache for derivatives
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        
        return new Response(object.body, { headers });
      } catch (error) {
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // Fall
    return newback: 404 Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

interface Env {
  PHOTO_BUCKET: R2Bucket;
}
