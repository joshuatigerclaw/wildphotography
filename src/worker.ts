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

      // Debug: check Neon token
      if (path === 'api/v1/debug') {
        const token = (env as any).NEON_TOKEN;
        return Response.json({ 
          hasToken: !!token, 
          tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
        });
      }

      // Debug: check photos
      if (path === 'api/v1/debug/photos') {
        const { getRecentPhotos } = await import('./lib/db');
        const photos = await getRecentPhotos(3);
        return Response.json({ 
          count: photos.length,
          photos: photos.map(p => ({ 
            slug: p.slug, 
            title: p.title,
            thumb_key: p.thumb_r2_key,
            small_key: p.small_r2_key
          }))
        });
      }

      // Debug: raw DB query
      if (path === 'api/v1/debug/raw') {
        const { queryNeon } = await import('./lib/db');
        try {
          // Check columns
          const cols = await queryNeon("SELECT column_name FROM information_schema.columns WHERE table_name = 'photos' ORDER BY ordinal_position");
          // Check if is_active exists
          const isActive = await queryNeon("SELECT COUNT(*) as cnt FROM photos WHERE is_active = true");
          // Check if derivative keys exist
          const withKeys = await queryNeon("SELECT COUNT(*) as cnt FROM photos WHERE thumb_r2_key IS NOT NULL OR small_r2_key IS NOT NULL OR medium_r2_key IS NOT NULL");
          // Get sample photo
          const sample = await queryNeon("SELECT id, slug, title, is_active, thumb_r2_key, small_r2_key FROM photos LIMIT 1");
          
          return Response.json({ 
            columns: cols,
            is_active_count: isActive,
            with_keys_count: withKeys,
            sample_photo: sample
          });
        } catch (e: any) {
          return Response.json({ error: e.message, stack: e.stack });
        }
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
