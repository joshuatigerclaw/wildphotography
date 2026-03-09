/**
 * Wildphotography - Combined Worker
 * 
 * Handles:
 * - Media serving (derivatives from R2)
 * - Health check
 * - Static pages (homepage, galleries, search, photo pages)
 * - Queue processing
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

const HTML_HOME = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wildphotography | Costa Rica Nature Photography</title>
  <meta name="description" content="Professional wildlife and nature photography from Costa Rica">
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
    header { padding: 2rem; text-align: center; background: #1a1a1a; color: white; }
    nav a { color: #aaa; margin: 0 1rem; text-decoration: none; }
    nav a:hover { color: white; }
    main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .hero { text-align: center; margin-bottom: 3rem; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; }
    .photo-card { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
    .photo-card img { width: 100%; height: 250px; object-fit: cover; }
    .photo-card .caption { padding: 1rem; }
    footer { padding: 2rem; text-align: center; background: #1a1a1a; color: #666; margin-top: 3rem; }
  </style>
</head>
<body>
  <header>
    <h1>Wildphotography</h1>
    <p>Costa Rica Nature Photography</p>
    <nav>
      <a href="/galleries">Galleries</a>
      <a href="/search">Search</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <h2>Welcome</h2>
      <p>Professional wildlife and nature photography from Costa Rica.</p>
    </section>
    <section class="gallery">
      <div class="photo-card">
        <img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="Scarlet Macaw">
        <div class="caption">
          <h3>Scarlet Macaw</h3>
          <p>Costa Rica's most iconic bird</p>
        </div>
      </div>
      <div class="photo-card">
        <img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="Tropical">
        <div class="caption">
          <h3>Tropical Paradise</h3>
          <p>Costa Rica landscapes</p>
        </div>
      </div>
    </section>
  </main>
  <footer>
    <p>&copy; 2026 Joshua ten Brink / Wildphotography</p>
  </footer>
</body>
</html>`;

const HTML_GALLERIES = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galleries | Wildphotography</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; }
    header { padding: 2rem; text-align: center; background: #1a1a1a; color: white; }
    nav a { color: #aaa; margin: 0 1rem; text-decoration: none; }
    main { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .gallery-list { list-style: none; padding: 0; }
    .gallery-list li { padding: 1rem; border-bottom: 1px solid #eee; }
    .gallery-list a { font-size: 1.2rem; color: #333; }
  </style>
</head>
<body>
  <header>
    <h1>Photo Galleries</h1>
    <nav><a href="/">Home</a> | <a href="/search">Search</a></nav>
  </header>
  <main>
    <ul class="gallery-list">
      <li><a href="/gallery/surfing-costa-rica">Surfing Costa Rica</a></li>
      <li><a href="/gallery/rivers">Rivers</a></li>
      <li><a href="/gallery/volcan-poas">Volcan Poas</a></li>
      <li><a href="/gallery/turtles">Turtles</a></li>
    </ul>
  </main>
</body>
</html>`;

const HTML_SEARCH = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search | Wildphotography</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; }
    header { padding: 2rem; text-align: center; background: #1a1a1a; color: white; }
    nav a { color: #aaa; margin: 0 1rem; text-decoration: none; }
    main { max-width: 600px; margin: 0 auto; padding: 2rem; }
    form { display: flex; gap: 1rem; margin-top: 2rem; }
    input { flex: 1; padding: 0.75rem; font-size: 1rem; }
    button { padding: 0.75rem 1.5rem; font-size: 1rem; background: #333; color: white; border: none; cursor: pointer; }
  </style>
</head>
<body>
  <header>
    <h1>Search Photos</h1>
    <nav><a href="/">Home</a> | <a href="/galleries">Galleries</a></nav>
  </header>
  <main>
    <form action="/search" method="get">
      <input type="text" name="q" placeholder="Search photos...">
      <button type="submit">Search</button>
    </form>
  </main>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // Health check
    if (path === 'api/v1/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // Queue test
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

    // Block originals and downloads
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

    // Static pages
    if (path === '' || path === '/') {
      return new Response(HTML_HOME, { headers: { 'Content-Type': 'text/html' } });
    }

    if (path === 'galleries' || path === 'galleries/') {
      return new Response(HTML_GALLERIES, { headers: { 'Content-Type': 'text/html' } });
    }

    if (path === 'search' || path === 'search/') {
      return new Response(HTML_SEARCH, { headers: { 'Content-Type': 'text/html' } });
    }

    // Gallery pages
    if (path.startsWith('gallery/')) {
      const slug = path.replace('gallery/', '').replace('/', '');
      return new Response(`<html><!DOCTYPE html>
<head><title>${slug} | Wildphotography</title>
<style>body{font-family:system-ui;margin:0}header{background:#1a1a1a;color:white;padding:2rem;text-align:center}nav a{color:#aaa;margin:0 1rem}main{max-width:1200px;margin:0 auto;padding:2rem}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2rem}.photo-card{border:1px solid #ddd;border-radius:8px;overflow:hidden}.photo-card img{width:100%;height:250px;object-fit:cover}.caption{padding:1rem}</style>
</head>
<body>
<header><h1>${slug}</h1><nav><a href="/">Home</a> | <a href="/galleries">Galleries</a></nav></header>
<main>
<div class="gallery">
<div class="photo-card"><img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="Sample"><div class="caption"><h3>Sample Photo</h3></div></div>
</div>
</main>
</body></html>`, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Photo pages
    if (path.startsWith('photo/')) {
      const slug = path.replace('photo/', '').replace('/', '');
      return new Response(`<!DOCTYPE html>
<html><head><title>${slug} | Wildphotography</title>
<style>body{font-family:system-ui;margin:0}header{background:#1a1a1a;color:white;padding:2rem;text-align:center}nav a{color:#aaa;margin:0 1rem}main{max-width:1000px;margin:0 auto;padding:2rem}img{max-width:100%;height:auto}</style>
</head>
<body>
<header><h1>${slug}</h1><nav><a href="/">Home</a> | <a href="/galleries">Galleries</a></nav></header>
<main>
<img src="${MEDIA_BASE}/derivatives/large/scarlet-macaw-test-large.jpg" alt="${slug}">
<p><a href="${MEDIA_BASE}/derivatives/originals/scarlet-macaw-test.jpg" target="_blank">Download</a></p>
</main>
</body></html>`, {
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
