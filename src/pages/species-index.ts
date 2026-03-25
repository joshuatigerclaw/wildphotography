import { getSpeciesList, queryNeon } from '../lib/db';
import type { Env } from '../types';

/**
 * Species Index Page - Dynamically generated from DB
 */
export async function renderSpeciesIndex(env: Env, url: URL): Promise<Response> {
  const speciesRows = await queryNeon<any>(`
    SELECT 
      species_common_name, 
      COUNT(*) as photo_count,
      MIN(small_url) as sample_url
    FROM photos 
    WHERE species_common_name IS NOT NULL 
      AND species_common_name != ''
      AND ready_for_public_render = true
      AND small_url IS NOT NULL
    GROUP BY species_common_name 
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `);
  
  const totalSpecies = speciesRows.length;
  
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Bird Species of Costa Rica",
    "description": `Explore ${totalSpecies} photographed bird species of Costa Rica including macaws, toucans, quetzals, hummingbirds, and more by Joshua ten Brink.`,
    "url": "https://wildphotography.com/species"
  });
  
  const speciesCards = speciesRows.map((r: any) => {
    const slug = r.species_common_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const displayName = r.species_common_name;
    const imgUrl = r.sample_url || '';
    return `
      <a href="/species/${slug}" class="species-card">
        ${imgUrl ? `<img src="${imgUrl}" alt="${displayName}" loading="lazy" width="300" height="200">` : '<div class="no-image">No photo yet</div>'}
        <div class="species-card-content">
          <h2>${displayName}</h2>
          <p class="count">${r.photo_count} photo${r.photo_count !== 1 ? 's' : ''}</p>
        </div>
      </a>
    `;
  }).join('');
  
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bird Species of Costa Rica - WildPhotography</title>
  <meta name="description" content="Explore ${totalSpecies} photographed bird species of Costa Rica. Find the best locations for Scarlet Macaws, Quetzals, Toucans, Hummingbirds and more.">
  <meta property="og:title" content="Bird Species of Costa Rica">
  <meta property="og:description" content="Explore ${totalSpecies} photographed bird species of Costa Rica">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://wildphotography.com/species">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #fafafa; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #1a365d; }
    .lead { font-size: 1.2rem; color: #666; margin-bottom: 2rem; }
    .breadcrumb { color: #666; margin-bottom: 1rem; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .species-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
    .species-card { background: white; border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s, box-shadow 0.2s; }
    .species-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .species-card img { width: 100%; height: 180px; object-fit: cover; display: block; }
    .species-card-content { padding: 1rem; }
    .species-card h2 { margin: 0 0 0.25rem 0; color: #2c5282; font-size: 1.1rem; }
    .species-card .count { margin: 0; color: #666; font-size: 0.85rem; }
    .no-image { width: 100%; height: 180px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.9rem; }
    .stats { display: flex; gap: 2rem; margin: 2rem 0; flex-wrap: wrap; }
    .stat { text-align: center; }
    .stat-num { font-size: 2rem; font-weight: bold; color: #2c5282; }
    .stat-label { color: #666; font-size: 0.9rem; }
    .back-link { display: inline-block; margin-bottom: 1rem; color: #2c7a7b; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    @media (max-width: 640px) {
      .species-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      h1 { font-size: 1.8rem; }
    }
  </style>

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
  <div class="container">
    <a href="/" class="back-link">&larr; Back to Home</a>
    <nav class="breadcrumb"><a href="/">Home</a> > Species</nav>
    <h1>Bird Species of Costa Rica</h1>
    <p class="lead">Discover ${totalSpecies} photographed bird species from Costa Rica's incredible avian diversity.</p>
    
    <div class="stats">
      <div class="stat"><div class="stat-num">${totalSpecies}</div><div class="stat-label">Species Photographed</div></div>
      <div class="stat"><div class="stat-num">900+</div><div class="stat-label">Total Species</div></div>
      <div class="stat"><div class="stat-num">Year-round</div><div class="stat-label">Best Time</div></div>
    </div>
    
    <div class="species-grid">
      ${speciesCards}
    </div>
    
    <p style="margin-top: 2rem; color: #666; text-align: center;">
      <a href="/galleries" style="color: #2c7a7b;">Browse all galleries</a>
    </p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
