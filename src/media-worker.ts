/**
 * Media Worker - Serves derivatives from R2
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // Remove leading /
    
    console.log('Media request:', path);
    
    // Block originals and downloads
    if (path.startsWith('originals/') || path.startsWith('downloads/')) {
      return new Response('Forbidden', { status: 403 });
    }
    
    // Serve derivatives
    if (path.startsWith('derivatives/')) {
      try {
        // List objects to debug
        const prefix = path.substring(0, path.lastIndexOf('/') + 1);
        const listed = await env.PHOTO_BUCKET.list({ prefix, limit: 10 });
        console.log('Objects with prefix', prefix, ':', listed.objects?.map(o => o.key));
        
        const object = await env.PHOTO_BUCKET.get(path);
        
        if (!object) {
          return new Response('Not Found: ' + path, { 
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
        
        const contentType = object.httpMetadata?.contentType || 'image/jpeg';
        console.log('Serving:', path, 'with type:', contentType);
        
        return new Response(object.body, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      } catch (e) {
        console.error('Error:', e);
        return new Response('Error: ' + e, { status: 500 });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  },
};

interface Env {
  PHOTO_BUCKET: R2Bucket;
}
