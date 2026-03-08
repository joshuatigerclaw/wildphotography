/**
 * Wildphotography Media Worker
 * 
 * Serves media from R2 bucket with proper cache headers
 * Only serves derivative URLs, never originals
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // Remove leading slash

    // Security: Block access to originals
    if (path.startsWith('originals/')) {
      return new Response('Forbidden', { status: 403 });
    }

    // Only allow derivative paths
    const allowedPrefixes = [
      'derivatives/',
      'downloads/',
    ];
    
    const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));
    if (!isAllowed) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // Get object from R2
      const object = await env.PHOTO_BUCKET.get(path);
      
      if (!object) {
        return new Response('Not Found', { status: 404 });
      }

      // Set cache headers for derivatives (long-lived cache)
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      
      // Add immutable cache headers for derivatives
      if (path.startsWith('derivatives/')) {
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        headers.set('Cache-Control', 'public, max-age=86400');
      }

      return new Response(object.body, {
        headers,
      });
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

interface Env {
  PHOTO_BUCKET: R2Bucket;
}
