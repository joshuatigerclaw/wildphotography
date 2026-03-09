/**
 * Base page renderer
 */

export const MEDIA_BASE = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

export function renderPage(title: string, content: string): Response {
  return layout(title, content);
}

export function layout(title: string, content: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="Wildphotography">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
a { color: #0066cc; text-decoration: none; }
a:hover { text-decoration: underline; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr); gap: 1rem; padding: 1rem; }
.photo-card { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; transition: transform 0.2s; }
.photo-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
.photo-card img { width: 100%; height: 220px; object-fit: cover; }
.caption { padding: 1rem; }
h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
footer { background: #1a1a1a; color: #666; padding: 2rem; text-align: center; margin-top: 4rem; }
.hero { text-align: center; padding: 3rem; background: #f5f5f5; margin-bottom: 2rem; }
.back-link { display: inline-block; padding: 1rem; color: #0066cc; }
</style>
</head>
<body>
<header style="background:#1a1a1a;color:white;padding:2rem;text-align:center">
<h1 style="margin:0"><a href="/" style="color:white;text-decoration:none">Wildphotography</a></h1>
<p>Professional wildlife & nature photography</p>
<nav style="margin-top:1rem">
<a href="/" style="color:white;margin:0 0.5rem">Home</a>
<a href="/galleries" style="color:white;margin:0 0.5rem">Galleries</a>
<a href="/search" style="color:white;margin:0 0.5rem">Search</a>
</nav>
</header>
<main style="max-width:1200px;margin:0 auto;padding:1rem">
${content}
</main>
<footer style="text-align:center;padding:2rem;color:#666">
<p>&copy; 2026 Joshua ten Brink / Wildphotography</p>
</footer>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
