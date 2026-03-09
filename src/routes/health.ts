/**
 * Health check route
 */

import type { Env } from '../types';

export function handleHealth(): Response {
  return Response.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    runtime: 'cloudflare-workers',
    version: '2.0.0'
  });
}
