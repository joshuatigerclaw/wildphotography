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

const HTML_HOME = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wildphotography | Costa Rica Nature Photography</title>
  <meta name="description" content="Professional wildlife and nature photography from Costa Rica">
  <link rel="icon" href="/favicon.ico">
</head>
<body>
  <header style="padding: 2rem; text-align: center;">
    <h1>Wildphotography</h1>
    <p>Costa Rica Nature Photography</p>
    <nav style="margin-top: 1rem;">
      <a href="/galleries" style="margin: 0 1rem;">Galleries</a>
      <a href="/search" style="margin: 0 1rem;">Search</a>
    </nav>
  </header>
  <main style="padding: 2rem;">
    <section>
      <h2>Welcome</h2>
      <p>Professional wildlife and nature photography from Costa Rica.</p>
    </section>
  </main>
  <footer style="padding: 2rem; text-align: center; margin-top: 2rem;">
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
</head>
<body>
  <header style="padding: 2rem; text-align: center;">
    <h1>Photo Galleries</h1>
    <nav><a href="/">Home</a> | <a href="/search">Search</a></nav>
  </header>
  <main style="padding: 2rem;">
    <ul>
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
</head>
<body>
  <header style="padding: 2rem; text-align: center;">
    <h1>Search Photos</h1>
    <nav><a href="/">Home</a> | <a href="/galleries">Galleries</a></nav>
  </header>
  <main style="padding: 2rem;">
    <form action="/search" method="get">
      <input type="text" name="q" placeholder="Search photos..." style="padding: 0.5rem; width: 300px;">
      <button type="submit" style="padding: 0.5rem 1rem;">Search</button>
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
      return new Response(HTML_HOME, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (path === 'galleries' || path === 'galleries/') {
      return new Response(HTML_GALLERIES, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (path === 'search' || path === 'search/') {
      return new Response(HTML_SEARCH, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Gallery pages
    if (path.startsWith('gallery/')) {
      const slug = path.replace('gallery/', '').replace('/', '');
      return new Response(`<!DOCTYPE html>
<html><head><title>Gallery: ${slug} | Wildphotography</title></head>
<body><h1>Gallery: ${slug}</h1><p>Gallery page for ${slug}</p><a href="/galleries">Back to Galleries</a></body></html>`, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Photo pages
    if (path.startsWith('photo/')) {
      const slug = path.replace('photo/', '').replace('/', '');
      return new Response(`<!DOCTYPE html>
<html><head><title>Photo: ${slug} | Wildphotography</title></head>
<body><h1>Photo: ${slug}</h1><p>Photo page for ${slug}</p><a href="/">Home</a></body></html>`, {
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
