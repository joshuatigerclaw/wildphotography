/**
 * Queue test route
 */

import type { Env } from '../types';

export async function handleQueueTest(request: Request, env: Env, url: URL): Promise<Response> {
  const queueName = url.searchParams.get('queue') || 'smugmug-metadata';
  
  let queue;
  switch (queueName) {
    case 'metadata': queue = env.SMUGMUG_METADATA; break;
    case 'download': queue = env.SMUGMUG_DOWNLOAD; break;
    case 'typesense': queue = env.TYPESENSE_INDEX; break;
    default: return Response.json({ error: 'Unknown queue' }, { status: 400 });
  }

  await queue.send({ type: 'test', timestamp: Date.now() });
  return Response.json({ success: true, queue: queueName });
}
