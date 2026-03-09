/**
 * Page renderer - Base layout and utilities
 */

import type { Env } from '../types';

export const MEDIA_BASE = 'https://wildphotography-media.josh-ec6.workers.dev';

export function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
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
    .back-link { color: #666; text-decoration: none; margin-bottom: 1rem; display: inline-block; }
    .back-link:hover { color: #0066cc; }
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
</html>`;
}

export function renderPage(title: string, content: string): Response {
  return new Response(layout(title, content), {
    headers: { 'Content-Type': 'text/html' }
  });
}
