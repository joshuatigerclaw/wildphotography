/**
 * Base page renderer with enhanced styling and SEO
 */

export const MEDIA_BASE = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';

export function renderPage(title: string, content: string): Response {
  return layout(title, content);
}

/**
 * Extended layout with SEO support
 */
export function layout(
  title: string, 
  content: string, 
  extraHead: string = '', 
  customCss: string = '',
  options: {
    canonical?: string;
    description?: string;
    ogImage?: string;
    ogType?: string;
    noindex?: boolean;
    jsonLd?: string;
  } = {}
): Response {
  const {
    canonical = '',
    description = 'Professional wildlife and nature photography from Costa Rica by Joshua ten Brink',
    ogImage = '',
    ogType = 'website',
    noindex = false,
    jsonLd = ''
  } = options;

  // Build SEO tags
  let seoTags = '';
  if (canonical) seoTags += `<link rel="canonical" href="${canonical}">\n`;
  if (description) seoTags += `<meta name="description" content="${description.replace(/"/g, '&quot;')}">\n`;
  if (noindex) seoTags += `<meta name="robots" content="noindex, follow">\n`;
  if (ogImage) seoTags += `<meta property="og:image" content="${ogImage}">\n`;
  seoTags += `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}">\n`;
  seoTags += `<meta property="og:description" content="${description.replace(/"/g, '&quot;')}">\n`;
  seoTags += `<meta property="og:type" content="${ogType}">\n`;
  seoTags += `<meta property="og:url" content="${canonical || 'https://wildphotography.com'}">\n`;
  seoTags += `<meta property="og:site_name" content="WildPhotography">\n`;
  seoTags += `<meta name="twitter:card" content="summary_large_image">\n`;

  const jsonLdTag = jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
${seoTags}
${extraHead}
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; background: #fafafa; }
a { color: #0066cc; text-decoration: none; }
a:hover { text-decoration: underline; }

/* Header */
header { background: #1a1a1a; color: white; padding: 1rem 2rem; position: sticky; top: 0; z-index: 100; }
header h1 { margin: 0; font-size: 1.4rem; font-weight: 600; }
header a { color: white; }
header a:hover { color: #4db8ff; }
.header-container { max-width: 1400px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.logo { display: flex; align-items: center; gap: 0.5rem; }

/* Navigation */
.nav-main { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.nav-main a { color: #e0e0e0; font-size: 0.95rem; padding: 0.4rem 0; border-bottom: 2px solid transparent; transition: all 0.2s; }
.nav-main a:hover { color: #4db8ff; border-bottom-color: #4db8ff; }
.nav-main a.active { color: #4db8ff; border-bottom-color: #4db8ff; }
.search-form { display: flex; align-items: center; }
.search-form input { padding: 0.5rem 0.8rem; border-radius: 4px; border: 1px solid #444; background: #333; color: white; font-size: 0.85rem; width: 180px; }
.search-form input:focus { outline: none; border-color: #4db8ff; }

/* Main */
main { max-width: 1400px; margin: 0 auto; padding: 2rem; min-height: 60vh; }

/* Footer */
footer { background: #1a1a1a; color: #999; padding: 3rem 2rem; margin-top: 4rem; }
.footer-container { max-width: 1400px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; }
.footer-section h3 { color: white; font-size: 1rem; margin-bottom: 1rem; }
.footer-section a { color: #999; display: block; padding: 0.3rem 0; font-size: 0.9rem; }
.footer-section a:hover { color: #4db8ff; }
.footer-bottom { max-width: 1400px; margin: 2rem auto 0; padding-top: 2rem; border-top: 1px solid #333; text-align: center; font-size: 0.85rem; }
.disclaimer { background: #252525; padding: 1rem; border-radius: 6px; margin-top: 1rem; font-size: 0.8rem; line-height: 1.5; }

/* Hero */
.hero { text-align: center; padding: 3rem 1rem; background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; border-radius: 12px; margin-bottom: 3rem; }
.hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
.hero p { font-size: 1.2rem; opacity: 0.9; }

/* Sections */
.section-title { font-size: 1.8rem; color: #1a365d; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0; }

/* Cards */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
.card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; }
.card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
.card img { width: 100%; height: 180px; object-fit: cover; }
.card-content { padding: 1rem; }
.card-type { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #2c7a7b; font-weight: 600; margin-bottom: 0.4rem; }
.card-title { font-size: 1.1rem; color: #1a365d; margin-bottom: 0.5rem; }
.card-desc { font-size: 0.9rem; color: #666; }
.card-link { display: inline-block; margin-top: 0.8rem; color: #2c7a7b; font-weight: 500; }

/* Photo Grid */
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.photo-card { display: block; position: relative; overflow: hidden; border-radius: 8px; }
.photo-card img { width: 100%; height: 220px; object-fit: cover; transition: transform 0.3s; }
.photo-card:hover img { transform: scale(1.05); }
.photo-meta { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: white; padding: 2rem 1rem 1rem; font-size: 0.9rem; }

/* Photo Detail Page */
.photo-detail { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem; }
.photo-header { margin-bottom: 1.5rem; }
.photo-header h1 { font-size: 2rem; color: #1a365d; margin-bottom: 0; }
.photo-image { width: 100%; margin-bottom: 2rem; text-align: center; }
.photo-image img.main-photo { max-width: 100%; height: auto; display: inline-block; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }

/* E: Description block — below image and affiliate, above location */
.photo-description-block { margin-bottom: 1.5rem; }
.photo-description { font-size: 1.05rem; color: #3d4852; line-height: 1.75; max-width: 680px; }

/* F: Location hierarchy — prominent, above metadata */
.photo-location-hierarchy {
  font-size: 0.95rem;
  color: #4a5568;
  margin-bottom: 0.75rem;
  padding: 0.6rem 1rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-left: 3px solid #2c7a7b;
  border-radius: 0 6px 6px 0;
}
.photo-location-hierarchy strong { color: #2d3748; }

/* F: Compact metadata — inline, visually lighter than description */
.compact-meta {
  font-size: 0.85rem;
  color: #718096;
  margin-bottom: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}
.compact-meta .meta-item strong { color: #4a5568; }

/* Keywords — below metadata, above map */
.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1.5rem;
}
.keywords-label {
  font-weight: 600;
  color: #4a5568;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 0.25rem;
  white-space: nowrap;
}
.keyword-chip {
  display: inline-block;
  padding: 0.2rem 0.65rem;
  background: #e2e8f0;
  color: #2d3748;
  border-radius: 999px;
  font-size: 0.82rem;
  text-decoration: none;
  transition: background 0.2s;
  border: 1px solid transparent;
}
.keyword-chip:hover {
  background: #cbd5e0;
  border-color: #a0aec0;
}

/* Metadata */
.metadata { background: #f7fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
.metadata ul { list-style: none; padding: 0; margin: 0; }
.metadata li { padding: 0.3rem 0; font-size: 0.9rem; color: #4a5568; }
.metadata strong { color: #2d3748; }

/* Location / Map */
.location-section { margin-bottom: 2rem; }
.map-container { border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.location-map { width: 100%; height: auto; display: block; }

/* Discovery modules */
.discovery-section { margin-top: 2.5rem; padding-top: 2rem; border-top: 2px solid #e2e8f0; }
.discovery-heading {
  font-size: 1.25rem;
  color: #1a365d;
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}
.related-photos-grid,
.related-species-grid,
.related-location-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* Downloads */
.downloads { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; }
.buy-button { background: #2c7a7b; color: white; border: none; padding: 0.85rem 2rem; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
.buy-button:hover { background: #234e52; }
.buy-button:disabled { background: #a0aec0; cursor: not-allowed; }
#checkout-status { margin-top: 0.5rem; font-size: 0.9rem; color: #4a5568; }
.back-link { display: inline-block; margin-bottom: 1.5rem; color: #2c7a7b; text-decoration: none; font-size: 0.9rem; }
.back-link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .nav-main { gap: 1rem; }
  .nav-main a { font-size: 0.85rem; }
  .search-form input { width: 140px; }
  .photo-detail { padding: 1rem 0.75rem; }
  .photo-header h1 { font-size: 1.5rem; }
  .photo-description { font-size: 0.95rem; }
  .photo-location-hierarchy { font-size: 0.85rem; padding: 0.5rem 0.75rem; }
  .compact-meta { font-size: 0.8rem; }
  .keywords { gap: 0.3rem; }
  .keywords-label { font-size: 0.75rem; }
  .keyword-chip { font-size: 0.75rem; padding: 0.15rem 0.5rem; }
  .photo-image img.main-photo { width: 100%; border-radius: 6px; }
  .related-photos-grid,
  .related-species-grid,
  .related-location-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }
}
</style>
${jsonLdTag}

<!-- GetYourGuide Analytics -->
<script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="6ZV7KMH"></script>

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-EPPFTRYF92"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-EPPFTRYF92');
</script>
</head>
<body>
<header>
<div class="header-container">
  <h1 class="logo"><a href="/">WildPhotography</a></h1>
  <nav class="nav-main">
    <form action="/search" method="get" class="search-form">
      <input type="text" name="q" placeholder="Search photos, species..." aria-label="Search">
    </form>
    <a href="/">Home</a>
    <a href="/species">Species</a>
    <a href="/region">Regions</a>
    <a href="/article">Articles</a>
    <a href="/galleries">Galleries</a>
  </nav>
</div>
</header>
<main>
${content}
</main>
<footer>
<div class="footer-container">
  <div class="footer-section">
    <h3>Explore</h3>
    <a href="/species">Bird Species</a>
    <a href="/region">Birding Regions</a>
    <a href="/article">Articles & Guides</a>
    <a href="/galleries">Photo Galleries</a>
    <a href="/search">Search Photos</a>
  </div>
  <div class="footer-section">
    <h3>Popular</h3>
    <a href="/species/scarlet-macaw">Scarlet Macaw</a>
    <a href="/species/resplendent-quetzal">Resplendent Quetzal</a>
    <a href="/species/keel-billed-toucan">Keel-billed Toucan</a>
    <a href="/region/monteverde">Monteverde</a>
    <a href="/region/corcovado">Corcovado</a>
  </div>
  <div class="footer-section">
    <h3>About</h3>
    <a href="/">Home</a>
    <a href="/article/about">About Joshua</a>
    <a href="/article/contact">Contact</a>
  </div>
</div>
<div class="footer-bottom">
  <p>&copy; 2026 Joshua ten Brink / WildPhotography. Professional wildlife & nature photography from Costa Rica.</p>
  <div class="disclaimer">
    <strong>Affiliate Disclosure:</strong> This site includes affiliate links to tours, travel services, and related products. 
    If you book or purchase through these links, WildPhotography.com may earn a commission at no additional cost to you.
  </div>
</div>
</footer>
<script async defer src="https://widget.getyourguide.com/v2/widget.js"></script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
