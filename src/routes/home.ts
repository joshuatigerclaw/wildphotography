/**
 * Home route (placeholder - to be connected to Neon)
 */

import type { Env } from '../types';

export async function handleHome(env: Env): Promise<Response> {
  // TODO: Connect to Neon DB
  // const photos = await getRecentPhotos();
  return new Response('Home', { status: 200 });
}
