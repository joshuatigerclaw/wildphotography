import { getPhotosBySpecies, getSpeciesList } from '../lib/db';
import type { Env } from '../types';

// Hardcoded species definitions (for SEO structure)
// Valid gallery slugs confirmed to exist in the database
const SPECIES: Record<string, any> = {
  "resplendent-quetzal": {
    name: "Resplendent Quetzal", scientific: "Pharomachrus mocinno", family: "Trogonidae",
    description: "The Resplendent Quetzal is one of the most beautiful birds in the world. The male has stunning emerald green plumage with extraordinary tail feathers that can reach 2 feet in length.",
    whereToSee: ["San Gerardo de Dota", "Central Valley", "Rainforests"],
    gallerySlugs: { "San Gerardo de Dota": "/gallery/rainforests", "Central Valley": "/gallery/rainforests", "Rainforests": "/gallery/rainforests" },
    regions: ["Central Valley", "Rainforests"],
    itinerary: { slug: "birds", label: "Costa Rica Birding Guide" },
    gear: { slug: "birds", label: "Bird Photography Gear Guide" },
    ogImage: "https://images.wildphotography.com/derivatives/small/quetzal-CL0A1052-small.jpg"
  },
  "scarlet-macaw": {
    name: "Scarlet Macaw", scientific: "Ara macao", family: "Psittacidae",
    description: "Vibrant red, yellow, and blue parrot found in the tropical forests of Costa Rica.",
    whereToSee: ["Carara Area", "Osa Peninsula", "Pacific Coast"],
    gallerySlugs: { "Carara Area": "/gallery/rainforests", "Osa Peninsula": "/gallery/peninsula-de-osa", "Pacific Coast": "/gallery/birds-macaws-lapas" },
    regions: ["Pacific Coast"],
    itinerary: { slug: "birds", label: "Costa Rica Birding Guide" },
    gear: { slug: "birds", label: "Best Gear for Bird Photography" },
    ogImage: "https://images.wildphotography.com/derivatives/small/dec757ca30434cf61e8f007edc18f0cf00021cd79609797786e630bb54057001.jpg"
  },
  "great-green-macaw": {
    name: "Great Green Macaw", scientific: "Ara ambiguus", family: "Psittacidae",
    description: "Costa Rica's largest parrot - endangered species.",
    whereToSee: ["Caribbean Coast", "Rainforests"],
    gallerySlugs: { "Caribbean Coast": "/gallery/limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva", "Rainforests": "/gallery/rainforests" },
    regions: ["Caribbean", "Rainforests"],
    itinerary: { slug: "birds", label: "Costa Rica Birding Itinerary" },
    gear: { slug: "birds", label: "Bird Photography Gear" },
  },
  "keel-billed-toucan": {
    name: "Keel-billed Toucan", scientific: "Ramphastos sulfuratus", family: "Ramphastidae",
    description: "Known for its spectacular multi-colored bill.",
    whereToSee: ["Caribbean Coast", "Rainforests"],
    gallerySlugs: { "Caribbean Coast": "/gallery/limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva", "Rainforests": "/gallery/rainforests" },
    regions: ["Caribbean", "Rainforests"],
    itinerary: { slug: "birds", label: "Costa Rica Birding Guide" },
    gear: { slug: "birds", label: "Gear for Toucan Photography" },
    ogImage: "https://images.wildphotography.com/derivatives/small/17cb9ac620874ca9d6137a1ad2fefaa5abc70843296bb5bac8ecf584a43881fc.jpg"
  },
  "turquoise-browed-motmot": {
    name: "Turquoise-browed Motmot", scientific: "Eumomota superciliosa", family: "Momotidae",
    description: "Costa Rica's national bird with distinctive turquoise brow and racket-shaped tail.",
    whereToSee: ["Guanacaste", "Northwest Pacific"],
    gallerySlugs: { "Guanacaste": "/gallery/guanacaste-costa-rica-travel-and-tourism", "Northwest Pacific": "/gallery/guanacaste-costa-rica-travel-and-tourism" },
    regions: ["Guanacaste", "Northwest"],
    itinerary: { slug: "birds", label: "Guanacaste Birding Guide" },
    gear: { slug: "birds", label: "Photography Gear for Endemics" },
  },
  "rufous-tailed-hummingbird": {
    name: "Rufous-tailed Hummingbird", scientific: "Amazilia tzacatl", family: "Trochilidae",
    description: "One of the most common hummingbirds in Costa Rica. Males have rufous tail feathers and greenish breast.",
    whereToSee: ["Throughout Costa Rica", "Gardens", "Forest Edges"],
    gallerySlugs: { "Throughout Costa Rica": "/gallery/birds", "Gardens": "/gallery/birds", "Forest Edges": "/gallery/rainforests" },
    regions: ["All Regions"],
    itinerary: { slug: "birds", label: "Hummingbird Watching Itinerary" },
    gear: { slug: "birds", label: "Hummingbird Photography Gear" },
    ogImage: "https://images.wildphotography.com/derivatives/small/77208ea8f186970b6c3de42a82bf421669d7113cc9dff8af4cfaf1e99bbcf948.jpg"
  },
  "anhinga": {
    name: "Anhinga", scientific: "Anhinga anhinga", family: "Anhingidae",
    description: "A waterbird often seen swimming with only its neck above water, giving it the nickname 'snakebird'.",
    whereToSee: ["Wetlands", "Coastal Areas", "Rivers"],
    gallerySlugs: { "Wetlands": "/gallery/waterfalls-in-costa-rica", "Coastal Areas": "/gallery/beaches", "Rivers": "/gallery/rivers" },
    regions: ["Wetlands", "Coastal"],
    itinerary: { slug: "birds", label: "Wetland Birding Itinerary" },
    gear: { slug: "birds", label: "Waterbird Photography Gear" },
  },
  "great-kiskadee": {
    name: "Great Kiskadee", scientific: "Pitangus sulphuratus", family: "Tyrannidae",
    description: "A bold, conspicuous flycatcher with a distinctive 'kis-ka-dee' call, found throughout Costa Rica.",
    whereToSee: ["Throughout Costa Rica", "Open Areas", "Gardens"],
    gallerySlugs: { "Throughout Costa Rica": "/gallery/birds", "Open Areas": "/gallery/birds", "Gardens": "/gallery/birds" },
    regions: ["All Regions"],
    itinerary: { slug: "birds", label: "Costa Rica Birding Itinerary" },
    gear: { slug: "birds", label: "General Bird Photography Gear" },
  },
  "green-heron": {
    name: "Green Heron", scientific: "Butorides virescens", family: "Ardeidae",
    description: "A small, compact heron often found along the edges of ponds, streams, and mangroves.",
    whereToSee: ["Wetlands", "River Banks", "Coastal Marshes"],
    gallerySlugs: { "Wetlands": "/gallery/waterfalls-in-costa-rica", "River Banks": "/gallery/rivers", "Coastal Marshes": "/gallery/beaches" },
    regions: ["Wetlands", "Coastal"],
    itinerary: { slug: "birds", label: "Wetland Birding Itinerary" },
    gear: { slug: "birds", label: "Heron Photography Gear" },
  },
  "yellow-throated-toucan": {
    name: "Yellow-throated Toucan", scientific: "Ramphastos ambiguus", family: "Ramphastidae",
    description: "Formerly called Black-mandibled Toucan - a large toucan with distinctive yellow throat and chest.",
    whereToSee: ["Rainforests", "Highland Forests"],
    gallerySlugs: { "Rainforests": "/gallery/rainforests", "Highland Forests": "/gallery/rainforests" },
    regions: ["Rainforests", "Highlands"],
    itinerary: { slug: "birds", label: "Toucan Watching Guide" },
    gear: { slug: "birds", label: "Gear for Toucan Photography" },
  },
  "olive-ridley-turtle": {
    name: "Olive Ridley Turtle", scientific: "Lepidochelys olivacea", family: "Cheloniidae",
    description: "One of the smallest sea turtles, known for its olive-colored shell and remarkable mass nesting behavior called 'arribada'.",
    whereToSee: ["Ostional", "Playa Grande", "Pacific Coast Beaches"],
    gallerySlugs: { "Ostional": "/gallery/turtles", "Playa Grande": "/gallery/turtles", "Pacific Coast Beaches": "/gallery/beaches" },
    regions: ["Guanacaste", "Pacific Coast"],
    itinerary: { slug: "birds", label: "Wildlife Watching Guide" },
    gear: { slug: "birds", label: "Wildlife Photography Gear" },
    ogImage: "https://images.wildphotography.com/derivatives/small/44Rg89-small.jpg"
  },
  "brown-pelican": {
    name: "Brown Pelican", scientific: "Pelecanus occidentalis", family: "Pelecanidae",
    description: "Large coastal bird famous for plunge-diving into the ocean to catch fish. Common along both Pacific and Caribbean coasts of Costa Rica.",
    whereToSee: ["Pacific Coast", "Caribbean Coast", "Bays", "Harbors"],
    gallerySlugs: { "Pacific Coast": "/gallery/beaches", "Caribbean Coast": "/gallery/limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva", "Bays": "/gallery/beaches", "Harbors": "/gallery/boats-in-costa-rica" },
    regions: ["Pacific Coast", "Caribbean Coast"],
    itinerary: { slug: "birds", label: "Coastal Birding Itinerary" },
    gear: { slug: "birds", label: "Coastal Bird Photography Gear" },
    ogImage: "https://images.wildphotography.com/derivatives/small/22c1d4f3a0f324eff5bd9fa38e26d89a3a27e219eedec59e6579c3c1b8b36922.jpg"
  },
  "white-throated-magpie-jay": {
    name: "White-throated Magpie-Jay", scientific: "Calocitta formosa", family: "Corvidae",
    description: "A striking crested jay endemic to Central America, with distinctive white throat patch and long graduated tail. Common in Guanacaste dry forests.",
    whereToSee: ["Guanacaste", "Dry Forests", "Pacific Northwest"],
    gallerySlugs: { "Guanacaste": "/gallery/guanacaste-costa-rica-travel-and-tourism", "Dry Forests": "/gallery/guanacaste-costa-rica-travel-and-tourism", "Pacific Northwest": "/gallery/guanacaste-costa-rica-travel-and-tourism" },
    regions: ["Guanacaste", "Northwest"],
    itinerary: { slug: "birds", label: "Guanacaste Birding Guide" },
    gear: { slug: "birds", label: "Bird Photography Gear" },
    ogImage: "https://images.wildphotography.com/derivatives/small/4fda39e2bd20c522b56c9221813dd51abf2ed6e0b666f0129a00d08333bcf8dc.jpg"
  },
  "tricolored-heron": {
    name: "Tricolored Heron", scientific: "Egretta tricolor", family: "Ardeidae",
    description: "A slender heron with distinctive reddish-brown neck and white belly stripe. Often seen wading in shallow coastal waters.",
    whereToSee: ["Wetlands", "Mangroves", "Coastal Marshes", "Tortuguero"],
    gallerySlugs: { "Wetlands": "/gallery/waterfalls-in-costa-rica", "Mangroves": "/gallery/rivers", "Coastal Marshes": "/gallery/beaches", "Tortuguero": "/gallery/turtles" },
    regions: ["Caribbean", "Wetlands", "Coastal"],
    itinerary: { slug: "birds", label: "Wetland Birding Itinerary" },
    gear: { slug: "birds", label: "Waterbird Photography Gear" },
    ogImage: "https://images.wildphotography.com/derivatives/small/CL0A8973.jpg"
  },
};

export async function renderSpeciesIndex(env: Env, url: URL): Promise<Response> {
  const speciesList = await getSpeciesList();
  
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Bird Species of Costa Rica",
    "description": "Explore stunning photographs of Costa Rica's bird species including macaws, toucans, quetzals, and more.",
    "url": "https://wildphotography.com/species"
  });
  
  const html = `<!doctype html>
<html lang="en">
<head>
  <title>Bird Species of Costa Rica - WildPhotography</title>
  <meta name="description" content="Explore stunning photographs of Costa Rica's bird species including macaws, toucans, quetzals, hummingbirds, and more.">
  <meta property="og:title" content="Bird Species of Costa Rica">
  <meta property="og:description" content="Explore stunning photographs of Costa Rica's bird species">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://wildphotography.com/species">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; background: #fafafa; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2rem; color: #1a365d; }
    .species-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
    .species-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .species-card img { width: 100%; height: 200px; object-fit: cover; }
    .species-card-content { padding: 1rem; }
    .species-card h2 { font-size: 1.2rem; color: #1a365d; margin: 0 0 0.5rem; }
    .species-card a { color: #2c7a7b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Bird Species of Costa Rica</h1>
    <div class="species-grid">
      ${Object.entries(SPECIES).map(([slug, s]: [string, any]) => `
        <div class="species-card">
          <a href="/species/${slug}">
            <h2>${s.name}</h2>
          </a>
          <div class="species-card-content">
            <p style="color: #666; font-style: italic;">${s.scientific}</p>
            <p>${s.description.substring(0, 100)}...</p>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function renderSpecies(slug: string, env: Env, url: URL): Promise<Response> {
  const s = SPECIES[slug];
  if (!s) return new Response("Species not found", { status: 404 });
  
  // Get photos for this species
  const photos = await getPhotosBySpecies(s.name, 10);
  
  const seoTitle = s.name + " Costa Rica - Photography & Where to See | WildPhotography";
  const seoDesc = s.name + " (" + s.scientific + "). " + s.description + " Find the best locations to see this bird in Costa Rica.";
  
  // Enhanced JSON-LD for species
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": seoTitle,
    "description": seoDesc,
    "image": s.ogImage || (photos[0]?.small_url),
    "author": {
      "@type": "Person",
      "name": "Joshua ten Brink"
    },
    "publisher": {
      "@type": "Organization",
      "name": "WildPhotography"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://wildphotography.com/species/" + slug
    }
  });
  
  // Get image URL from photo record
  function getPhotoUrl(photo: any): string {
    return photo.small_url || photo.r2_web_small_key || '';
  }
  
  const heroImage = s.ogImage || (photos.length > 0 ? getPhotoUrl(photos[0]) : '');
  
  const html = `<!doctype html>
<html lang="en">
<head>
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDesc}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${seoDesc}">
  <meta property="og:image" content="${heroImage}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://wildphotography.com/species/${slug}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${seoTitle}">
  <meta name="twitter:description" content="${seoDesc}">
  <meta name="twitter:image" content="${heroImage}">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; background: #fafafa; }
    .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.2rem; color: #1a365d; margin-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; color: #1a365d; margin-top: 2rem; }
    .scientific { color: #666; font-style: italic; font-size: 1.1rem; }
    .description { font-size: 1.1rem; line-height: 1.7; color: #4a5568; margin: 1rem 0; }
    .card { background: white; padding: 1.5rem; border-radius: 8px; margin: 1rem 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .region-link { display: inline-block; margin: 0.3rem; padding: 0.4rem 0.8rem; background: #e2e8f0; border-radius: 4px; text-decoration: none; color: #333; }
    .cta-btn { display: inline-block; background: #2c7a7b; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .cta-btn:hover { background: #236c6d; }
    .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .photo-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .photo-card img { width: 100%; height: 200px; object-fit: cover; }
    .photo-card-content { padding: 0.8rem; }
    .photo-card a { color: #2c7a7b; text-decoration: none; }
    .hero-image { width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; margin: 1rem 0; }
    .breadcrumb { color: #666; margin-bottom: 1rem; }
    .breadcrumb a { color: #666; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Home</a> &gt; <a href="/species">Species</a> &gt; ${s.name}
    </nav>
    
    <h1>${s.name}</h1>
    <p class="scientific">${s.scientific}</p>
    <p>Family: ${s.family}</p>
    <p class="description">${s.description}</p>
    
    ${photos.length > 0 ? `
    <div class="card">
      <h2>Photos</h2>
      <div class="photo-grid">
        ${photos.map((photo: any) => `
          <div class="photo-card">
            <a href="/photo/${photo.slug}">
              <img src="${getPhotoUrl(photo)}" alt="${photo.title || s.name}">
              <div class="photo-card-content">${photo.title || s.name}</div>
            </a>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="card">
      <h2>Where to See in Costa Rica</h2>
      <ul>${s.whereToSee.map((l: string) => {
        const gallerySlug = s.gallerySlugs ? s.gallerySlugs[l] : null;
        if (gallerySlug) {
          return `<li><a href="${gallerySlug}">${l}</a></li>`;
        }
        return `<li>${l}</li>`;
      }).join('')}</ul>
    </div>

    ${s.itinerary ? `
    <div class="card">
      <h2>Suggested Itinerary</h2>
      <p>Plan your trip to see the ${s.name}:</p>
      <a href="/article/${s.itinerary.slug}" class="cta-btn">${s.itinerary.label} &rarr;</a>
    </div>
    ` : ''}

    ${s.gear ? `
    <div class="card">
      <h2>Photography Gear</h2>
      <p>Recommended equipment for photographing the ${s.name}:</p>
      <a href="/article/${s.gear.slug}" class="cta-btn">${s.gear.label} &rarr;</a>
    </div>
    ` : ''}

    <div class="card">
      <h2>Regions</h2>
      <p>${s.regions.join(', ')}</p>
    </div>

    <h3>View by Region</h3>
    <div>${s.regions.map((r: string) => `<a href="/region/${r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}" class="region-link">${r}</a>`).join('')}</div>
    
    <div style="margin-top: 2rem;"><a href="/species" style="color: #2c7a7b;">View All Species</a></div>
  </div>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
