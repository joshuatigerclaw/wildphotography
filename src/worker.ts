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

// Queue handlers - Pipeline Stage 1-4
import { handleSmugMugMetadataCrawl } from './routes/stage1-metadata';
import { handleSmugMugDownload } from './routes/stage2-download';
import { handleDerivativeGeneration } from './routes/stage3-derivative';
import { handleTypesenseIndex } from './routes/stage4-typesense';

// Repair mode
import { handleRepairMode } from './routes/repair';

// Pages
import { renderHome } from './pages/home';
import { renderGalleries } from './pages/galleries';
import { renderSearch } from './pages/search';
import { renderGallery } from './pages/gallery';
import { renderPhoto } from './pages/photo';
import { renderArticle } from './pages/article';
import { renderLocation } from './pages/location';
import { renderSpecies } from './pages/species';
import { renderSpeciesIndex } from './pages/species-index';
import { renderRegion } from './pages/region';
import { renderArticleIndex } from './pages/article-index';
import { renderRegionIndex } from './pages/region-index';
import { renderGYGRedirect } from './pages/affiliate-gyg';
import { renderViatorRedirect } from './pages/affiliate-viator';
import { renderTripadvisorRedirect } from './pages/affiliate-tripadvisor';
import { render404, render403 } from './pages/errors';
import { handleDailyRandomFeed } from './routes/feed-daily-random';

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
      
      // API: paginated photos for infinite scroll
      if (path === 'api/photos') {
        const url = new URL(request.url);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        
        const { getPhotosBatch } = await import('./lib/db');
        const photos = await getPhotosBatch(offset);
        
        const hasMore = photos.length > 36;
        const displayPhotos = photos.slice(0, 36);
        
        const response = Response.json({
          photos: displayPhotos.map((p: any) => ({
            slug: p.slug,
            title: p.title || '',
            small_url: p.small_url,
            gallery_slug: p.gallery_slug,
            gallery_name: p.gallery_name,
          })),
          hasMore,
          offset,
        });
        
        response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
        return response;
      }

      // API: paginated galleries for infinite scroll
      if (path === 'api/galleries') {
        const url = new URL(request.url);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const limit = 24;
        
        const { queryNeon } = await import('./lib/db');
        const rows = await queryNeon(`
          SELECT g.id, g.slug, g.name, g.description,
            p.small_url, p.medium_url
          FROM galleries g
          LEFT JOIN LATERAL (
            SELECT p.small_url, p.medium_url
            FROM gallery_photos gp
            JOIN photos p ON gp.photo_id = p.id
            WHERE gp.gallery_id = g.id 
              AND p.is_active = true 
              AND p.ready_for_public_render = true
              AND p.small_url IS NOT NULL
            LIMIT 1
          ) p ON true
          WHERE g.is_active = true
          ORDER BY g.name
          LIMIT ${limit + 1}
          OFFSET ${offset}
        `);
        
        const hasMore = rows.length > limit;
        const galleries = rows.slice(0, limit);
        
        return Response.json({
          galleries: galleries.map((g: any) => ({
            slug: g.slug,
            name: g.name,
            description: g.description,
            small_url: g.small_url,
            medium_url: g.medium_url,
          })),
          hasMore,
          offset,
        });
      }

      // API: paginated gallery photos for infinite scroll
      if (path === 'api/gallery-photos') {
        const url = new URL(request.url);
        const slug = url.searchParams.get('slug');
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        
        if (!slug) {
          return Response.json({ error: 'Missing slug parameter' }, { status: 400 });
        }
        
        const { getPhotosByGallery, getGalleryPhotoCount } = await import('./lib/db');
        const photos = await getPhotosByGallery(slug, limit + 1, offset);
        const totalCount = await getGalleryPhotoCount(slug);
        
        const hasMore = photos.length > limit;
        const displayPhotos = photos.slice(0, limit);
        
        const response = Response.json({
          photos: displayPhotos.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            title: p.title || '',
            width: p.width,
            height: p.height,
            thumb_url: p.thumb_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.thumb_r2_key}` : null,
            small_url: p.small_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.small_r2_key}` : null,
            medium_url: p.medium_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.medium_r2_key}` : null,
            large_url: p.large_r2_key ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/${p.large_r2_key}` : null,
          })),
          hasMore,
          offset: offset + displayPhotos.length,
          total: totalCount,
        });
        
        response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
        return response;
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

      // Queue derivative generation
      if (path === 'api/v1/queue/derivative') {
        const { handleDerivativeGeneration } = await import('./routes/derivative');
        const body = await request.json();
        const { photoId, smugmugKey, slug } = body;
        
        if (!photoId || !smugmugKey || !slug) {
          return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const result = await handleDerivativeGeneration({ photoId, smugmugKey, slug }, env);
        return Response.json(result);
      }

      // Pipeline Stage 1: Metadata crawl
      if (path === 'api/v1/pipeline/metadata') {
        const { handleSmugMugMetadataCrawl } = await import('./routes/stage1-metadata');
        const body = await request.json();
        const result = await handleSmugMugMetadataCrawl(body, env);
        return Response.json(result);
      }

      // Pipeline Stage 2: Download original
      if (path === 'api/v1/pipeline/download') {
        const { handleSmugMugDownload } = await import('./routes/stage2-download');
        const body = await request.json();
        const result = await handleSmugMugDownload(body, env);
        return Response.json(result);
      }

      // Pipeline Stage 3: Generate derivatives
      if (path === 'api/v1/pipeline/derivatives') {
        const { handleDerivativeGeneration } = await import('./routes/stage3-derivative');
        const body = await request.json();
        const result = await handleDerivativeGeneration(body, env);
        return Response.json(result);
      }

      // Pipeline Stage 4: Typesense index
      if (path === 'api/v1/pipeline/typesense') {
        const { handleTypesenseIndex } = await import('./routes/stage4-typesense');
        const body = await request.json();
        const result = await handleTypesenseIndex(body, env);
        return Response.json(result);
      }

      // Repair mode
      if (path === 'api/v1/repair') {
        const { handleRepairMode } = await import('./routes/repair');
        const body = await request.json();
        const result = await handleRepairMode(body, env);
        return Response.json(result);
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
      // Sitemap index
      if (path === 'sitemap.xml') {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        xml += '  <sitemap><loc>https://wildphotography.com/sitemaps/pages.xml</loc></sitemap>\n';
        xml += '  <sitemap><loc>https://wildphotography.com/sitemaps/galleries.xml</loc></sitemap>\n';
        xml += '  <sitemap><loc>https://wildphotography.com/sitemaps/photos.xml</loc></sitemap>\n';
        xml += '</sitemapindex>';
        
        const response = new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
        response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return response;
      }

      // Sitemap: pages
      if (path === 'sitemaps/pages.xml') {
        const pages = [
          { loc: '', priority: '1.0', changefreq: 'daily' },
          { loc: 'galleries', priority: '0.9', changefreq: 'weekly' },
        ];
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        for (const p of pages) {
          xml += `  <url><loc>https://wildphotography.com/${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>\n`;
        }
        
        xml += '</urlset>';
        
        const response = new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
        response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return response;
      }

      // Sitemap: galleries
      if (path === 'sitemaps/galleries.xml') {
        const { getGalleries } = await import('./lib/db');
        const galleries = await getGalleries();
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        for (const g of galleries) {
          xml += `  <url><loc>https://wildphotography.com/gallery/${g.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
        }
        
        xml += '</urlset>';
        
        const response = new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
        response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return response;
      }

      // Sitemap: photos with image metadata
      if (path === 'sitemaps/photos.xml') {
        const { getPublicPhotosForSitemap } = await import('./lib/db');
        const photos = await getPublicPhotosForSitemap(5000);
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        // Use Google's image namespace for Google Images compatibility
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
        
        for (const p of photos) {
          // Clean title for image caption
          let title = p.title || p.gallery_name || 'Costa Rica Photography';
          title = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          
          // Use large_url for image indexing
          const imgUrl = p.large_url || p.medium_url || p.small_url || '';
          
          if (imgUrl) {
            xml += `  <url><loc>https://wildphotography.com/photo/${p.slug}</loc><lastmod>${p.date_uploaded || '2026-01-01'}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority>`;
            xml += `\n    <image:image><image:loc>${imgUrl}</image:loc><image:title>${title}</image:title></image:image>`;
            xml += '\n  </url>\n';
          }
        }
        
        xml += '</urlset>';
        
        const response = new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
        response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return response;
      }
      
      if (path === 'robots.txt') {
        const robots = `User-agent: *
Allow: /
Sitemap: https://wildphotography.com/sitemap.xml
Disallow: /api/
`;
        return new Response(robots, { headers: { 'Content-Type': 'text/plain' } });
      }

      if (routes[path]) {
        return routes[path](env, url);
      }

      // Dynamic routes
      try {
        if (path.startsWith('gallery/')) {
          const slug = path.replace('gallery/', '').replace(/\/$/, '');
          return await renderGallery(slug, env, url);
        }

        if (path.startsWith('photo/')) {
          const slug = path.replace('photo/', '').replace(/\/$/, '');
          return await renderPhoto(slug, env, url);
        }

        if (path === 'article') {
          return await renderArticleIndex(env, url);
        }

        if (path.startsWith('article/')) {
          const slug = path.replace('article/', '').replace(/\/$/, '');
          return await renderArticle(slug, env, url);
        }

        if (path.startsWith('species/')) {
          const speciesSlug = path.replace('species/', '').replace(/\/$/, '');
          return await renderSpecies(speciesSlug, env, url);
        }

        if (path === 'species') {
          return await renderSpeciesIndex(env, url);
        }

        if (path === 'region') {
          return await renderRegionIndex(env, url);
        }

        if (path.startsWith('region/')) {
          const regionSlug = path.replace('region/', '').replace(/\/$/, '');
          return await renderRegion(regionSlug, env, url);
        }

        if (path.startsWith('location/')) {
          const locationSlug = path.replace('location/', '').replace(/\/$/, '');
          return await renderLocation(locationSlug, env, url);
        }

        if (url.pathname === '/feed/daily-random.xml') {
          return handleDailyRandomFeed(request, env);
        }

        // Affiliate redirect: /go/gyg/:slug
        if (path.startsWith('go/gyg/')) {
          const slug = path.replace('go/gyg/', '').replace(/\/$/, '');
          return await renderGYGRedirect(slug, env);
        }

        // Affiliate redirect: /go/viator/:slug
        if (path.startsWith('go/viator/')) {
          const slug = path.replace('go/viator/', '').replace(/\/$/, '');
          return await renderViatorRedirect(slug, env);
        }

        // Affiliate redirect: /go/tripadvisor
        if (path === 'go/tripadvisor') {
          return renderTripadvisorRedirect();
        }

      // API: region data
        if (path === 'api/regions') {
          const { getRegionApi } = await import('./pages/region');
          return await getRegionApi('all', env);
        }
        if (path.startsWith('api/region/')) {
          const regionSlug = path.replace('api/region/', '').replace(/\/$/, '');
          const { getRegionApi } = await import('./pages/region');
          return await getRegionApi(regionSlug, env);
        }
        if (path.startsWith('api/location/')) {
          const locationSlug = path.replace('api/location/', '').replace(/\/$/, '');
          const { getLocationApi } = await import('./pages/region');
          return await getLocationApi(locationSlug, env);
        }
      } catch (e) {
        console.error('[worker] Dynamic route error:', e);
        return new Response('Error: ' + String(e), { status: 500 });
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
        
        // Route to appropriate handler - 4-Stage Pipeline
        switch (batch.queue) {
          case 'smugmug-metadata':
            // Stage 1: Metadata crawl
            await handleSmugMugMetadataCrawl(body, env);
            break;
          case 'smugmug-download':
            // Stage 2: Original download
            await handleSmugMugDownload(body, env);
            break;
          case 'derivative-generation':
            // Stage 3: Derivative generation
            await handleDerivativeGeneration(body, env);
            break;
          case 'typesense-index':
            // Stage 4: Typesense indexing
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

// Old handlers removed - now using stage1-4 imports
