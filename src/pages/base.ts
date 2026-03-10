/**
 * Base page renderer with enhanced styling
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
<meta name="description" content="Wildphotography - Professional wildlife and nature photography from Costa Rica">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { 
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
  line-height: 1.6; 
  color: #333;
  background: #fafafa;
}
a { color: #0066cc; text-decoration: none; }
a:hover { text-decoration: underline; }

/* Header */
header { 
  background: #1a1a1a; 
  color: white; 
  padding: 1.5rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
}
header h1 { 
  margin: 0; 
  font-size: 1.5rem; 
  font-weight: 600;
}
header a { color: white; }
nav { margin-top: 0.75rem }
nav a { 
  color: #aaa; 
  margin: 0 1rem; 
  font-size: 0.95rem;
  transition: color 0.2s;
}
nav a:hover { color: white; }

/* Main */
main { 
  max-width: 1400px; 
  margin: 0 auto; 
  padding: 2rem 1rem;
}

/* Hero */
.hero { 
  text-align: center; 
  padding: 4rem 2rem; 
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  color: white;
  margin: -2rem -1rem 3rem;
  border-radius: 0 0 24px 24px;
}
.hero h1 { font-size: 3rem; margin-bottom: 0.5rem; font-weight: 700; }
.hero p { font-size: 1.25rem; color: #aaa; }

/* Sections */
section { margin-bottom: 4rem; }
section h2 { 
  font-size: 1.75rem; 
  margin-bottom: 1rem; 
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #eee;
}
.section-desc { color: #666; margin-bottom: 1.5rem; }

/* Gallery Grid */
.gallery { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
  gap: 1.5rem; 
}

/* Photo Cards */
.photo-card { 
  border: none; 
  border-radius: 12px; 
  overflow: hidden; 
  transition: transform 0.3s, box-shadow 0.3s; 
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.photo-card:hover { 
  transform: translateY(-6px); 
  box-shadow: 0 12px 32px rgba(0,0,0,0.15);
  text-decoration: none;
}
.photo-card img { 
  width: 100%; 
  height: 280px; 
  object-fit: cover; 
  display: block;
}
.photo-card .caption { 
  padding: 1.25rem; 
}
.photo-card h3 { 
  font-size: 1rem; 
  font-weight: 500;
  color: #222;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Gallery Cards */
.gallery-card { 
  border: 1px solid #e0e0e0; 
  border-radius: 12px; 
  padding: 1.5rem; 
  transition: all 0.3s;
  background: white;
}
.gallery-card:hover { 
  border-color: #0066cc;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  text-decoration: none;
}
.gallery-card h3 { font-size: 1.25rem; margin-bottom: 0.5rem; }
.gallery-card p { color: #666; margin: 0; }

/* Back Link */
.back-link { 
  display: inline-block; 
  padding: 0.75rem 0; 
  color: #666; 
  margin-bottom: 1rem;
}
.back-link:hover { color: #0066cc; }

/* Photo Detail */
.photo-detail { max-width: 900px; margin: 0 auto; }
.photo-header { margin-bottom: 2rem; text-align: center; }
.photo-header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
.photo-description { 
  color: #666; 
  font-size: 1.1rem; 
  max-width: 600px; 
  margin: 0 auto;
}

.photo-image { 
  margin-bottom: 2rem; 
  border-radius: 12px; 
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.main-photo { 
  width: 100%; 
  height: auto; 
  display: block;
}

/* Keywords */
.keywords { 
  margin: 1.5rem 0; 
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}
.keywords-label { 
  font-weight: 600; 
  margin-right: 0.5rem;
  color: #666;
}
.keyword-chip {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  margin: 0.25rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 0.85rem;
  color: #333;
  transition: all 0.2s;
}
.keyword-chip:hover {
  background: #0066cc;
  border-color: #0066cc;
  color: white;
  text-decoration: none;
}

/* Metadata */
.metadata { 
  margin: 1.5rem 0; 
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
}
.metadata ul { list-style: none; }
.metadata li { padding: 0.25rem 0; color: #555; }
.metadata strong { color: #333; }

/* Location Map */
.location-section { margin: 2rem 0; }
.location-section h3 { margin-bottom: 1rem; }
.map-container { 
  border-radius: 12px; 
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
.location-map { width: 100%; height: auto; display: block; }
.location-name { 
  margin-top: 0.75rem; 
  color: #666; 
  font-size: 0.95rem;
}

/* Downloads */
.downloads { 
  margin-top: 2rem; 
  padding: 2rem;
  background: linear-gradient(135deg, #f5f5f5 0%, #eee 100%);
  border-radius: 12px;
  text-align: center;
}
.buy-button {
  background: linear-gradient(135deg, #0070ba 0%, #005a8c 100%);
  color: white;
  padding: 1rem 2.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0,112,186,0.3);
}
.buy-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,112,186,0.4);
}
.buy-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}
#checkout-status { margin-top: 1rem; color: #666; }

/* Footer */
footer { 
  background: #1a1a1a; 
  color: #666; 
  padding: 3rem; 
  text-align: center; 
  margin-top: 4rem;
}
</style>
</head>
<body>
<header>
<div style="max-width:1400px;margin:0 auto">
<h1><a href="/">Wildphotography</a></h1>
<nav>
<a href="/">Home</a>
<a href="/galleries">Galleries</a>
<a href="/search">Search</a>
</nav>
</div>
</header>
<main>
${content}
</main>
<footer>
<p>&copy; 2026 Joshua ten Brink / Wildphotography</p>
</footer>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
