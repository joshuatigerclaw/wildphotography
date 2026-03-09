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
        const photos = await getRecentPhotos(20);
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

      // Debug: check gallery photos
      if (path === 'api/v1/debug/gallery') {
        const url = new URL(request.url);
        const slug = url.searchParams.get('slug') || 'surfing-costa-rica';
        const { getPhotosByGallery } = await import('./lib/db');
        const photos = await getPhotosByGallery(slug);
        
        // Also check raw DB
        const { queryNeon } = await import('./lib/db');
        const rawRows = await queryNeon(`SELECT p.slug, p.thumb_url FROM photos p JOIN gallery_photos gp ON p.id=gp.photo_id JOIN galleries g ON gp.gallery_id=g.id WHERE g.slug = '${slug}' LIMIT 5`);
        
        return Response.json({ 
          slug,
          count: photos.length,
          raw_thumb_urls: rawRows,
          photos: photos.map(p => ({ 
            slug: p.slug, 
            title: p.title,
            thumb_key: p.thumb_r2_key,
            small_key: p.small_r2_key
          }))
        });
      }

      // Debug: check original_r2_key
      if (path === 'api/v1/debug/originals') {
        const { queryNeon } = await import('./lib/db');
        try {
          const rows = await queryNeon("SELECT slug, original_r2_key, thumb_url, small_url FROM photos WHERE original_r2_key IS NOT NULL LIMIT 5");
          return Response.json({ 
            originals: rows
          });
        } catch (e: any) {
          return Response.json({ error: e.message });
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
