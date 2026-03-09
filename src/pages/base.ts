/**
 * Base page renderer
 */

export const MEDIA_BASE = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

export function renderPage(title: string, content: string): Response {
  return layout(title, content);
}

export function layout(title: string, content: string): Response {
  const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + title + '</title>\n<meta name="description" content="Wildphotography">\n<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }\na { color: #0066cc; text-decoration: none; }\na:hover { text-decoration: underline; }\n.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr); gap: 1rem; padding: 1rem; }\n.photo-card { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; transition: transform 0.2s; }\n.photo-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }\n.photo-card img { width: 100%; height: 220px; object-fit: cover; }\n.caption { padding: 1rem; }\nh3 { font-size: 1.1rem; margin-bottom: 0.5rem; }\nfooter { background: #1a1a1a; color: #666; padding: 2rem; text-align: center; margin-top: 4rem; }\n.hero { text-align: center; padding: 3rem; background: #f5f5f5; margin-bottom: 2rem; }\n.back-link { display: inline-block; padding: 1rem; color: #0066cc; }\n</style>\n</head>\n<body>\n<header style="background:#1a1a1a;color:white;padding:2rem;text-align:center">\n<h1 style="margin:0"><a href="/" style="color:white;text-decoration:none">Wildphotography</a></h1>\n<p>Professional wildlife & nature photography</p>\n<nav style="margin-top:1rem">\n<a href="/galleries" style="color:white;margin:0 0.5rem">Galleries</a>\n<a href="/search" style="color:white;margin:0 0.5rem">Search</a>\n</nav>\n</header>\n<main style="max-width:1200px;margin:0 auto;padding:1rem">\n' + content + '\n</main>\n<footer style="text-align:center;padding:2rem;color:#666">\n<p>&copy; 2026 Joshua ten Brink / Wildphotography</p>\n</footer>\n</body>\n</html>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
