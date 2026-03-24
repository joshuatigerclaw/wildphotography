import type { Env } from "../types";
import { getGalleryBySlug, getPhotosByGallery, queryNeon } from "../lib/db";
import { renderGYGWidget } from "../lib/monetization";

const GALLERY_ARTICLES: Record<string, { title: string; description: string; slug: string }> = {
  "arenal-volcano": { title: "Arenal Volcano Costa Rica", description: "Complete travel guide to Arenal Volcano, La Fortuna, and surrounding areas." },
  "monteverde": { title: "Monteverde Cloud Forest", description: "Discover the magic of Monteverde Cloud Forest Reserve." },
  "birds": { title: "Birdwatching in Costa Rica", description: "The ultimate guide to birdwatching with 900+ species." },
  "beaches": { title: "Best Beaches in Costa Rica", description: "From Guanacaste to the Caribbean - find your perfect beach." },
  "jaco-beach": { title: "Jaco Beach Guide", description: "Costa Rica's closest beach to San José." },
  "birdwatching-monteverde": { title: "Birdwatching in Monteverde", description: "Complete guide to birdwatching in Monteverde Cloud Forest - where to go, what to see, best times." },
  "top-birds-costa-rica": { title: "Top Birds of Costa Rica", description: "The most sought-after birds in Costa Rica - from quetzals to macaws." },
  "where-see-resplendent-quetzal": { title: "Where to See the Resplendent Quetzal", description: "Best locations in Costa Rica to spot the magnificent Resplendent Quetzal." },
  "hummingbirds-costa-rica": { title: "Costa Rica Hummingbirds Guide", description: "Discover the 50+ hummingbird species found in Costa Rica." },
  "scarlet-macaw-photography": { title: "Scarlet Macaw Photography Guide", description: "Tips for photographing Scarlet Macaws in Costa Rica." },
};

const MORE_LINKS = `
<a href="/article/birdwatching-monteverde" class="gallery-link">Birdwatching Monteverde</a>
<a href="/article/top-birds-costa-rica" class="gallery-link">Top Birds</a>
<a href="/article/where-see-resplendent-quetzal" class="gallery-link">Quetzal Guide</a>
<a href="/article/hummingbirds-costa-rica" class="gallery-link">Hummingbirds</a>

<a href="/article/arenal-volcano" class="gallery-link">Arenal Volcano</a>
<a href="/article/monteverde" class="gallery-link">Monteverde</a>
<a href="/article/birds" class="gallery-link">Birdwatching</a>
<a href="/article/beaches" class="gallery-link">Beaches</a>
<a href="/article/jaco-beach" class="gallery-link">Jaco Beach</a>
`;

// Fetch full article from content_articles table
async function getDbArticle(slug: string): Promise<any> {
  const safeSlug = slug.replace(/'/g, "''");
  const rows = await queryNeon<any>(`
    SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt, ca.content,
           ca.status, ca.featured_photo_id, ca.metadata,
           p.slug as photo_slug, p.thumb_url, p.small_url, p.medium_url, p.large_url
    FROM content_articles ca
    LEFT JOIN photos p ON p.id = ca.featured_photo_id
    WHERE ca.slug = '${safeSlug}'
  `);
  return rows[0] || null;
}

// Render full article with real content from DB
async function renderFullArticle(article: any, env: Env): Promise<Response> {
  const title = article.title;
  const excerpt = article.excerpt || '';
  const articleContent = article.content || '';
  const ogImage = article.small_url || article.thumb_url || '';
  const canonical = `https://wildphotography.com/article/${article.slug}`;

  // JSON-LD for article
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": excerpt,
    "image": ogImage,
    "author": { "@type": "Person", "name": "Joshua ten Brink" },
    "publisher": { "@type": "Organization", "name": "WildPhotography" },
    "url": canonical,
    "datePublished": article.published_at,
    "dateModified": article.updated_at,
  });

  // GYG CTA widget HTML - used mid-article
  const gygMidWidget = (location: string, ctaText: string, gygSlug: string) => `
    <div class="gyg-cta-block" style="margin: 2.5rem 0; padding: 1.5rem; border: 2px solid #2c7a7b; border-radius: 12px; background: #f0f9f9;">
      <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #2c7a7b; font-weight: 600;">Book a Wildlife Tour</p>
      <p style="margin: 0 0 1rem 0; font-size: 1.15rem; font-weight: 600; color: #1a365d;">${ctaText}</p>
      <a href="/go/gyg/${gygSlug}" style="display: inline-block; background: #2c7a7b; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 1rem;">View Tours on GetYourGuide →</a>
    </div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | WildPhotography</title>
  <meta name="description" content="${excerpt}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${excerpt}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #fafafa; }
    /* Full site header */
    .site-header { border-bottom: 1px solid #e2e8f0; background: #fff; }
    .site-header-inner { max-width: 1100px; margin: 0 auto; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; }
    .site-logo { font-size: 1.25rem; font-weight: 700; color: #1a365d; text-decoration: none; }
    .site-logo:hover { color: #2c7a7b; }
    .site-nav { display: flex; gap: 2rem; padding: 1rem 0; }
    .site-nav a { color: #4a5568; text-decoration: none; font-size: 0.95rem; font-weight: 500; transition: color 0.2s; }
    .site-nav a:hover { color: #2c7a7b; }
    /* Footer */
    .site-footer { border-top: 1px solid #e2e8f0; margin-top: 4rem; padding: 2rem; text-align: center; color: #888; font-size: 0.875rem; }
    /* Article layout */
    .container { max-width: 800px; margin: 0 auto; padding: 0 2rem 2rem; }
    .article-wrapper { padding-top: 0; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #1a365d; line-height: 1.2; }
    .lead { font-size: 1.2rem; color: #555; margin-bottom: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 1.5rem; line-height: 1.6; }
    .article-body { line-height: 1.8; font-size: 1.1rem; color: #2d3748; }
    .article-body h2 { color: #1a365d; font-size: 1.6rem; margin-top: 2.5rem; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    .article-body h3 { color: #2c5282; font-size: 1.25rem; margin-top: 1.75rem; }
    .article-body p { margin: 1.2rem 0; }
    .article-body ul, .article-body ol { padding-left: 1.5rem; margin: 1rem 0; }
    .article-body li { margin: 0.5rem 0; }
    .article-body strong { color: #1a202c; }
    .article-body a { color: #2c7a7b; text-decoration: underline; }
    .article-body a:hover { color: #236c6d; }
    .article-body blockquote { border-left: 4px solid #2c7a7b; padding: 1rem 1.5rem; background: #f0f4f8; margin: 1.5rem 0; font-style: italic; }
    .article-body code { background: #edf2f7; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    .article-body pre { background: #1a202c; color: #e2e8f0; padding: 1.5rem; border-radius: 8px; overflow-x: auto; margin: 1.5rem 0; }
    .article-featured-image { width: 100%; max-height: 500px; object-fit: cover; border-radius: 12px; margin-bottom: 2rem; }
    .gallery-link { display: inline-block; margin: 0.3rem; padding: 0.4rem 0.8rem; background: #e2e8f0; border-radius: 4px; text-decoration: none; color: #333; font-size: 0.9rem; }
    .gallery-link:hover { background: #cbd5e0; }
    .article-meta { color: #888; font-size: 0.9rem; margin-bottom: 1rem; }
    .related-section { margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #e2e8f0; }
    .breadcrumb { color: #888; margin-bottom: 1.5rem; font-size: 0.9rem; }
    .breadcrumb a { color: #888; text-decoration: none; }
    .breadcrumb a:hover { color: #2c7a7b; }
    /* GYG CTA blocks */
    .gyg-cta-block { margin: 2.5rem 0; padding: 1.5rem; border: 2px solid #2c7a7b; border-radius: 12px; background: #f0f9f9; }
    .gyg-cta-block p { margin: 0 0 0.5rem 0; }
    .gyg-cta-block .gyg-tag { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #2c7a7b; font-weight: 600; margin-bottom: 0.25rem; }
    .gyg-cta-block .gyg-headline { font-size: 1.1rem; font-weight: 600; color: #1a365d; margin-bottom: 1rem; }
    .gyg-cta-block .gyg-btn { display: inline-block; background: #2c7a7b; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 1rem; }
    .gyg-cta-block .gyg-btn:hover { background: #236c6d; }
    .gyg-bottom-cta { margin-top: 2rem; padding: 1.5rem; border: 2px solid #2c7a7b; border-radius: 12px; background: #f0f9f9; text-align: center; }
    .gyg-bottom-cta p { margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: #1a365d; }
    @media (max-width: 600px) {
      .site-nav { gap: 1.25rem; }
      .site-nav a { font-size: 0.875rem; }
      h1 { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
  <!-- Full site header -->
  <header class="site-header">
    <div class="site-header-inner">
      <a href="/" class="site-logo">Wildphotography</a>
      <nav class="site-nav">
        <a href="/galleries">Galleries</a>
        <a href="/species">Species</a>
        <a href="/region">Regions</a>
        <a href="/search">Search</a>
      </nav>
    </div>
  </header>

  <div class="article-wrapper">
    <div class="container">
      <nav class="breadcrumb"><a href="/">WildPhotography</a> &gt; <a href="/article">Articles</a> &gt; ${article.article_type?.replace('_', ' ') || 'Guide'}</nav>
      ${ogImage ? `<img src="${ogImage}" alt="${title}" class="article-featured-image">` : ''}
      <h1>${title}</h1>
      ${excerpt ? `<p class="lead">${excerpt}</p>` : ''}
      <div class="article-meta">By Joshua ten Brink &middot; Photography Guide</div>
      <div class="article-body">
        ${articleContent}
      </div>
      <div class="related-section">
        <h3>More Guides</h3>
        <div>${MORE_LINKS}</div>
      </div>
    </div>
  </div>

  <footer class="site-footer">
    &copy; ${new Date().getFullYear()} Wildphotography. All rights reserved.
  </footer>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function renderArticle(slug: string, env: Env, url: URL): Promise<Response> {
  // First check hardcoded GALLERY_ARTICLES stubs
  const stubArticle = GALLERY_ARTICLES[slug];
  if (stubArticle) {
    const photos = await getPhotosByGallery(slug, 6, 0);
    const photoGrid = photos.slice(0, 6).map(p =>
      `<a href="/photo/${p.slug}" class="article-photo"><img src="${p.r2_web_small_url || p.r2_thumb_url}" alt="${p.title || slug}" loading="lazy"></a>`
    ).join('');
    const gygWidget = renderGYGWidget(slug.replace(/-/g, " "), "tours");
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${stubArticle.title} | WildPhotography</title>
  <meta name="description" content="${stubArticle.description}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #fafafa; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .lead { font-size: 1.2rem; color: #666; margin-bottom: 2rem; }
    .photo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .article-photo { border-radius: 8px; overflow: hidden; display: block; }
    .article-photo img { width: 100%; height: 200px; object-fit: cover; transition: transform 0.3s; }
    .article-photo:hover img { transform: scale(1.02); }
    .content { line-height: 1.8; margin: 2rem 0; }
    .content h2 { margin-top: 2rem; }
    .cta { background: #2c7a7b; color: white; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; display: inline-block; margin: 1rem 0; }
    .cta:hover { background: #236c6d; }
    .gallery-link { display: inline-block; margin: 0.5rem; padding: 0.5rem 1rem; background: #e2e8f0; border-radius: 4px; text-decoration: none; color: #333; }
    .gallery-link:hover { background: #cbd5e0; }
  </style>
</head>
<body>
  <div class="container">
    <nav style="margin-bottom: 2rem;"><a href="/" style="color: #666; text-decoration: none;">← WildPhotography</a></nav>
    <h1>${stubArticle.title}</h1>
    <p class="lead">${stubArticle.description}</p>
    <h2>Photos from ${stubArticle.title}</h2>
    <div class="photo-grid">${photoGrid}</div>
    <div class="content">
      <h2>About This Destination</h2>
      <p>Discover the beauty of ${stubArticle.title}. Costa Rica offers incredible experiences for every type of traveler.</p>
      <h2>Photography Opportunities</h2>
      <p>Capture stunning images of landscapes, wildlife, and local culture.</p>
      <h2>Best Time to Visit</h2>
      <p>The dry season (December to April) offers the best conditions for photography.</p>
      <a href="/gallery/${slug}" class="cta">View Full Gallery -></a>
    </div>
    <h3>Book Tours & Activities</h3>
    ${gygWidget}
    <h3>More Destinations</h3>
    <div>${MORE_LINKS}</div>
  </div>
</body>
</html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Check DB content_articles table for full articles
  const dbArticle = await getDbArticle(slug);
  if (dbArticle) {
    return renderFullArticle(dbArticle, env);
  }

  return new Response("Article not found", { status: 404 });
}
