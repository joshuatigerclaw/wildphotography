/**
 * Wildphotography - Production Worker
 * 
 * PERMANENT RUNTIME (as of 2026-03-08)
 * 
 * Handles:
 * - Static HTML pages (homepage, galleries, search, gallery/photo pages)
 * - Media serving (derivatives from R2)
 * - Health check
 * - Queue processing
 * 
 * Note: This is a hybrid static/dynamic worker.
 * For full dynamic rendering, consider:
 * - Cloudflare D1 for local DB
 * - External API proxy for Neon data
 * - Vercel for full Next.js
 */

export interface Env {
  PHOTO_BUCKET: R2Bucket;
  SMUGMUG_METADATA: Queue;
  SMUGMUG_DOWNLOAD: Queue;
  TYPESENSE_INDEX: Queue;
  SITE_URL: string;
  MEDIA_BASE_URL: string;
}

const MEDIA_BASE = 'https://wildphotography-media.josh-ec6.workers.dev';

const templates = {
  layout: (title: string, content: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="Professional wildlife and nature photography from Costa Rica">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    header { background: #1a1a1a; color: white; padding: 2rem; text-align: center; }
    header h1 { margin-bottom: 0.5rem; }
    nav a { color: #aaa; margin: 0 1rem; text-decoration: none; transition: color 0.2s; }
    nav a:hover { color: white; }
    main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; margin-top: 2rem; }
    .photo-card { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
    .photo-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .photo-card img { width: 100%; height: 220px; object-fit: cover; }
    .photo-card .caption { padding: 1rem; }
    .photo-card h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
    .photo-card p { color: #666; font-size: 0.9rem; }
    footer { background: #1a1a1a; color: #666; padding: 2rem; text-align: center; margin-top: 4rem; }
    .hero { text-align: center; padding: 3rem 0; }
    .hero h2 { font-size: 2rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.2rem; color: #666; }
    form { display: flex; gap: 1rem; max-width: 500px; margin: 2rem auto; }
    input { flex: 1; padding: 0.75rem; font-size: 1rem; border: 1px solid #ddd; border-radius: 4px; }
    button { padding: 0.75rem 1.5rem; font-size: 1rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #555; }
    .gallery-list { list-style: none; }
    .gallery-list li { padding: 1rem; border-bottom: 1px solid #eee; }
    .gallery-list a { font-size: 1.2rem; color: #333; text-decoration: none; }
    .gallery-list a:hover { color: #0066cc; }
  </style>
</head>
<body>
  <header>
    <h1>Wildphotography</h1>
    <p>Costa Rica Nature Photography</p>
    <nav style="margin-top:1rem">
      <a href="/galleries">Galleries</a>
      <a href="/search">Search</a>
    </nav>
  </header>
  <main>${content}</main>
  <footer>
    <p>&copy; 2026 Joshua ten Brink / Wildphotography</p>
  </footer>
</body>
</html>`,

  home: () => templates.layout('Wildphotography | Costa Rica Nature Photography', `
    <section class="hero">
      <h2>Welcome</h2>
      <p>Professional wildlife and nature photography from Costa Rica</p>
    </section>
    <section>
      <h2>Featured Photos</h2>
      <div class="gallery">
        ${[1,2,3,4].map(i => `
        <div class="photo-card">
          <img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="Scarlet Macaw ${i}" loading="lazy">
          <div class="caption">
            <h3>Scarlet Macaw</h3>
            <p>Costa Rica's most iconic bird</p>
          </div>
        </div>`).join('')}
      </div>
    </section>
  `),

  galleries: () => templates.layout('Galleries | Wildphotography', `
    <h2>Photo Galleries</h2>
    <ul class="gallery-list">
      <li><a href="/gallery/surfing-costa-rica">Surfing Costa Rica</a></li>
      <li><a href="/gallery/rivers">Rivers</a></li>
      <li><a href="/gallery/volcan-poas">Volcan Poas</a></li>
      <li><a href="/gallery/turtles">Turtles</a></li>
    </ul>
  `),

  search: () => templates.layout('Search | Wildphotography', `
    <h2>Search Photos</h2>
    <form action="/search" method="get">
      <input type="text" name="q" placeholder="Search photos..." autofocus>
      <button type="submit">Search</button>
    </form>
    <p style="text-align:center;color:#666;margin-top:2rem">
      Try: bird, macaw, landscape, surf, turtle
    </p>
  `),

  gallery: (slug: string) => templates.layout(`${slug} | Wildphotography`, `
    <nav><a href="/galleries">← All Galleries</a></nav>
    <h2 style="margin:1rem 0">${slug}</h2>
    <div class="gallery">
      ${[1,2,3,4,5,6].map(i => `
      <div class="photo-card">
        <img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="Photo ${i}" loading="lazy">
        <div class="caption">
          <h3>Sample Photo ${i}</h3>
        </div>
      </div>`).join('')}
    </div>
  `),

  photo: (slug: string) => templates.layout(`${slug} | Wildphotography`, `
    <nav><a href="/">← Home</a></nav>
    <div style="text-align:center;padding:2rem 0">
      <img src="${MEDIA_BASE}/derivatives/large/scarlet-macaw-test-large.jpg" alt="${slug}" style="max-width:100%;border-radius:8px;">
      <p style="margin-top:1rem"><a href="${MEDIA_BASE}/derivatives/originals/scarlet-macaw-test.jpg" style="color:#0066cc">View Full Size</a></p>
    </div>
  `),
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1) || '';

    // Health check
    if (path === 'api/v1/health') {
      return Response.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        runtime: 'cloudflare-workers',
        version: '1.0.0'
      });
    }

    // Queue test endpoint
    if (path === 'api/v1/queue/test') {
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

    // Block private paths
    if (path.startsWith('originals/') || path.startsWith('downloads/')) {
      return new Response('Forbidden', { status: 403 });
    }

    // Serve derivatives from R2
    if (path.startsWith('derivatives/')) {
      try {
        const object = await env.PHOTO_BUCKET.get(path);
        if (!object) return new Response('Not Found', { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(object.body, { headers });
      } catch (error) {
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // Route pages
    const routes: Record<string, () => string> = {
      '': templates.home,
      'index': templates.home,
      'galleries': templates.galleries,
      'search': templates.search,
    };

    // Check exact routes
    if (routes[path]) {
      return new Response(routes[path](), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Gallery pages: /gallery/[slug]
    if (path.startsWith('gallery/')) {
      const slug = path.replace('gallery/', '').replace(/\/$/, '');
      return new Response(templates.gallery(slug), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Photo pages: /photo/[slug]
    if (path.startsWith('photo/')) {
      const slug = path.replace('photo/', '').replace(/\/$/, '');
      return new Response(templates.photo(slug), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      console.log(`[queue] ${batch.queue}:`, msg.body);
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env>;
