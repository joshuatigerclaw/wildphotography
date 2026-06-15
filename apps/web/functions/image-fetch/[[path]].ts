type R2Bucket = {
  get(key: string): Promise<R2Object | null>;
};
type R2Object = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

export async function onRequest(context: { request: Request; env: { PHOTOS_R2: R2Bucket } }): Promise<Response> {
  const url = new URL(context.request.url);
  const r2Key = url.searchParams.get('key');
  
  if (!r2Key) {
    return new Response('Missing key parameter', { status: 400 });
  }

  try {
    const object = await context.env.PHOTOS_R2.get(decodeURIComponent(r2Key));
    
    if (!object) {
      return new Response('Image not found in R2', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    
    return new Response(object.body, { headers });
  } catch (err) {
    return new Response('Error: ' + String(err), { status: 500 });
  }
}
