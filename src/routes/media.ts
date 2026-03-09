/**
 * Media (R2) route
 */

import type { Env } from '../types';

export async function handleMedia(path: string, env: Env): Promise<Response> {
  try {
    const object = await env.PHOTO_BUCKET.get(path);
    if (!object) return new Response('Not Found', { status: 404 });
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('[media] Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
