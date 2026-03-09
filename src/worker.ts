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
import type { MessageBatch } from '@cloudflare/workers-types';

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

      // Debug: check single photo
      if (path === 'api/v1/debug/photo') {
        const url = new URL(request.url);
        const slug = url.searchParams.get('slug') || 'img-9761-jpg-McvJMD';
        const { getPhotoBySlug } = await import('./lib/db');
        const photo = await getPhotoBySlug(slug);
        return Response.json({ 
          slug,
          photo
        });
      }
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

      // Checkout API
      if (path === 'api/v1/checkout/create') {
        const { createOrder } = await import('./lib/downloads');
        const body = await request.json();
        const { photoSlug, photoTitle, priceCents } = body;
        
        const result = await createOrder(photoSlug, photoTitle, priceCents || 2900, env);
        if (!result) {
          return Response.json({ error: 'Failed to create order' }, { status: 500 });
        }
        return Response.json(result);
      }

      // PayPal webhook
      if (path === 'api/v1/webhooks/paypal') {
        const { verifyWebhook, captureOrder } = await import('./lib/downloads');
        const bodyText = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => { headers[k] = v; });
        
        const verified = await verifyWebhook(bodyText, headers, env);
        if (!verified) {
          return Response.json({ error: 'Webhook verification failed' }, { status: 400 });
        }
        
        const body = JSON.parse(bodyText);
        if (body.event_type === 'CHECKOUT.ORDER.APPROVED') {
          const orderId = body.resource?.id;
          if (orderId) {
            await captureOrder(orderId, env);
          }
        }
        
        return Response.json({ received: true });
      }

      // Download fulfillment endpoint
      if (path.startsWith('api/v1/download/')) {
        const slug = path.replace('api/v1/download/', '');
        const url = new URL(request.url);
        const expires = url.searchParams.get('expires') || '';
        const signature = url.searchParams.get('sig') || '';
        
        const { verifyDownloadToken } = await import('./lib/downloads');
        
        if (!verifyDownloadToken(slug, expires, signature)) {
          return new Response('Download link expired or invalid', { status: 403 });
        }
        
        // Get the original from R2
        const { getPhotoBySlug } = await import('./lib/db');
        const photo = await getPhotoBySlug(slug);
        
        if (!photo?.original_r2_key) {
          return new Response('Original not found', { status: 404 });
        }
        
        // Redirect to R2 (in production, stream through worker)
        const r2Url = `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/originals/${photo.original_r2_key}`;
        
        // For now, redirect to the derivative (original is blocked)
        // In production, you'd stream the original through the worker
        return Response.redirect(r2Url, 302);
      }

      // === PUBLIC API ===
      
      // GET /api/public/photos/:slug
      if (path.startsWith('api/public/photos/')) {
        const slug = path.replace('api/public/photos/', '');
        const { getPhotoBySlug } = await import('./lib/db');
        const photo = await getPhotoBySlug(slug);
        
        if (!photo) {
          return Response.json({ error: 'Photo not found' }, { status: 404 });
        }
        
        // Return only safe public fields
        return Response.json({
          slug: photo.slug,
          title: photo.title,
          description: photo.description,
          location: photo.locationName,
          // Derivative URLs (safe)
          thumb_url: photo.thumb_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${photo.thumb_r2_key}` : null,
          small_url: photo.small_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${photo.small_r2_key}` : null,
          medium_url: photo.medium_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${photo.medium_r2_key}` : null,
          large_url: photo.large_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${photo.large_r2_key}` : null,
          // Canonical URL
          canonical_url: `${env.SITE_URL}/photo/${photo.slug}`,
          // No private fields exposed
        });
      }

      // GET /api/public/search?q=
      if (path === 'api/public/search') {
        const q = url.searchParams.get('q') || '';
        const { searchPhotos } = await import('./lib/db');
        const photos = await searchPhotos(q, 20);
        
        return Response.json({
          query: q,
          count: photos.length,
          results: photos.map(p => ({
            slug: p.slug,
            title: p.title,
            thumb_url: p.thumb_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.thumb_r2_key}` : null,
            canonical_url: `${env.SITE_URL}/photo/${p.slug}`,
          })),
        });
      }

      // GET /api/public/gallery/:slug
      if (path.startsWith('api/public/gallery/')) {
        const slug = path.replace('api/public/gallery/', '');
        const { getGalleryBySlug, getPhotosByGallery } = await import('./lib/db');
        
        const gallery = await getGalleryBySlug(slug);
        if (!gallery) {
          return Response.json({ error: 'Gallery not found' }, { status: 404 });
        }
        
        const photos = await getPhotosByGallery(slug);
        
        return Response.json({
          slug: gallery.slug,
          name: gallery.name,
          description: gallery.description,
          photo_count: photos.length,
          photos: photos.map(p => ({
            slug: p.slug,
            title: p.title,
            thumb_url: p.thumb_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.thumb_r2_key}` : null,
            small_url: p.small_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.small_r2_key}` : null,
            medium_url: p.medium_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.medium_r2_key}` : null,
            large_url: p.large_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.large_r2_key}` : null,
            canonical_url: `${env.SITE_URL}/photo/${p.slug}`,
          })),
        });
      }

      // GET /api/public/tag/:keywordSlug
      if (path.startsWith('api/public/tag/')) {
        const keywordSlug = path.replace('api/public/tag/', '');
        const keyword = keywordSlug.replace(/-/g, ' ');
        
        const { searchPhotos } = await import('./lib/db');
        const photos = await searchPhotos(keyword, 20);
        
        return Response.json({
          tag: keywordSlug,
          keyword,
          count: photos.length,
          photos: photos.map(p => ({
            slug: p.slug,
            title: p.title,
            thumb_url: p.thumb_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.thumb_r2_key}` : null,
            canonical_url: `${env.SITE_URL}/photo/${p.slug}`,
          })),
        });
      }

      // Download fulfillment
      if (path.startsWith('api/v1/download/')) {
        const token = url.searchParams.get('token');
        if (!token) {
          return Response.json({ error: 'Missing token' }, { status: 401 });
        }
        // TODO: Verify token and serve file
        return Response.json({ message: 'Download endpoint - implement token verification' });
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

  // Queue consumers with retry logic
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    console.log(`[queue] Processing ${batch.messages.length} messages from ${batch.queue}`);
    
    for (const msg of batch.messages) {
      const maxRetries = 5;
      const retryCount = msg.retryCount || 0;
      
      try {
        const body = msg.body as any;
        
        // Route to appropriate handler
        switch (batch.queue) {
          case 'smugmug-metadata':
            await handleSmugMugMetadata(body, env);
            break;
          case 'smugmug-download':
            await handleSmugMugDownload(body, env);
            break;
          case 'typesense-index':
            await handleTypesenseIndex(body, env);
            break;
          default:
            console.log(`[queue] Unknown queue: ${batch.queue}`);
        }
        
        msg.ack();
      } catch (error: any) {
        console.error(`[queue] Error (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
        
        // Check for rate limit (429)
        if (error.message?.includes('429') || error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
          const delay = (retryAfter || 60) * 1000;
          console.log(`[queue] Rate limited, waiting ${delay}ms before retry`);
          await new Promise(r => setTimeout(r, delay));
        }
        
        if (retryCount < maxRetries) {
          // Exponential backoff with jitter
          const baseDelay = Math.pow(2, retryCount) * 1000;
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          console.log(`[queue] Retrying in ${delay}ms (${retryCount + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          msg.retry();
        } else {
          console.error(`[queue] Max retries exceeded, discarding:`, JSON.stringify(msg.body));
          msg.ack();
        }
      }
    }
  },
} satisfies ExportedHandler<Env>;

// Queue message handlers

async function handleSmugMugMetadata(body: any, env: Env): Promise<void> {
  console.log(`[smugmug-metadata] Processing:`, body);
  // TODO: Implement metadata processing
}

async function handleSmugMugDownload(body: any, env: Env): Promise<void> {
  console.log(`[smugmug-download] Processing:`, body);
  // TODO: Implement download processing
}

async function handleTypesenseIndex(body: any, env: Env): Promise<void> {
  console.log(`[typesense-index] Processing:`, body);
  // TODO: Implement Typesense indexing
}
