export default {
  async fetch(request: Request, env: { PHOTOS: R2Bucket }): Promise<Response> {
    const url = new URL(request.url);
    // Support both query param (?key=...) and path (/key/...) for broad URL compatibility
    let key = url.searchParams.get('key');
    if (!key) {
      // Extract path segments after the domain, skip first empty segment
      const segments = url.pathname.split('/').filter(Boolean);
      key = decodeURIComponent(segments.join('/'));
    }

    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    try {
      const object = await env.PHOTOS.get(key);
      if (!object) {
        return new Response('Not found', { status: 404 });
      }
      const headers = new Headers();
      headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=86400, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      return new Response(object.body, { headers });
    } catch (err) {
      return new Response('Error: ' + String(err), { status: 500 });
    }
  },
};
