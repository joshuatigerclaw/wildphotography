/**
 * Wildphotography - Modular Worker Architecture
 * 
 * PERMANENT CLOUDFLARE RUNTIME
 * 
 * Architecture:
 * - Main App: Cloudflare Workers (NOT Pages)
 * - Media: Dedicated media Worker + R2
 * - Search: Typesense
 * - Database: Neon
 * 
 * Modules:
 * - routes/ - Route handlers
 * - pages/ - Page renderers
 * - lib/ - Shared utilities
 */

import type { Env } from './types';

// Route handlers
import { handleHealth } from './routes/health';
import { handleQueueTest } from './routes/queue';
import { handleMedia } from './routes/media';
import { handleHome } from './routes/home';
import { handleGalleries } from './routes/galleries';
import { handleSearch } from './routes/search';
import { handleGallery } from './routes/gallery';
import { handlePhoto } from './routes/photo';

// Pages
import { renderHome } from './pages/home';
import { renderGalleries } from './pages/galleries';
import { renderSearch } from './pages/search';
import { renderGallery } from './pages/gallery';
import { renderPhoto } from './pages/photo';
import { render404, render403 } from './pages/errors';

const MEDIA_BASE = 'https://wildphotography-media.josh-ec6.workers.dev';

export { MEDIA_BASE };

// ============================================================
// Main Fetch Handler
// ============================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1) || '';

    try {
      // API routes
      if (path === 'api/v1/health') {
        return handleHealth();
      }

      if (path === 'api/v1/queue/test') {
        return handleQueueTest(request, env, url);
      }

      // Media routes (R2)
      if (path.startsWith('derivatives/')) {
        return handleMedia(path, env);
      }

      // Block private paths
      if (path.startsWith('originals/') || path.startsWith('downloads/')) {
        return render403();
      }

      // Page routes
      const routes: Record<string, (env: Env, url: URL) => Promise<Response>> = {
        '': renderHome,
        'index': renderHome,
        'galleries': renderGalleries,
        'search': renderSearch,
      };

      // Exact route match
      if (routes[path]) {
        return routes[path](env, url);
      }

      // Dynamic routes
      if (path.startsWith('gallery/')) {
        const slug = path.replace('gallery/', '').replace(/\/$/, '');
        return renderGallery(slug, env, url);
      }

      if (path.startsWith('photo/')) {
        const slug = path.replace('photo/', '').replace(/\/$/, '');
        return renderPhoto(slug, env, url);
      }

      // 404
      return render404();

    } catch (error) {
      console.error('[worker] Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Queue consumers
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      console.log(`[queue] ${batch.queue}:`, msg.body);
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env>;
