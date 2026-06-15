import type { Env } from "../types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Location data mirrors what's in region.ts LOCATIONS
interface LocationData {
  name: string;
  regionSlug: string;
  habitat: string;
  seasons: { name: string; description: string }[];
  targetSpecies: string[];
  nearbyGalleries: string[];
  photographyTips: string[];
}

const LOCATIONS: Record<string, LocationData> = {
  "palo-verde-national-park": {
    name: "Palo Verde National Park",
    regionSlug: "guanacaste",
    habitat: "Dry forest, marshes, limestone cliffs",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Waterbirds concentrate in the marshes; Scarlet Macaws visible from river." },
      { name: "Green Season (May–Nov)", description: "Lush dry forest; fewer waterbirds; wildflowers and butterflies abundant." }
    ],
    targetSpecies: ["scarlet-macaw", "white-throated-magpie-jay", "northern-crested-caracara", "boat-billed-flycatcher", "white-fronted-amazon"],
    nearbyGalleries: ["guanacaste-costa-rica-travel-and-tourism", "birds-macaws-lapas", "wildlife"],
    photographyTips: ["The Tempisque River bridge is the best macaw flight photography point; arrive 30 min before sunset.", "Wading birds concentrate January–March in the marsh wetlands."]
  },
  "carara-national-park": {
    name: "Carara National Park",
    regionSlug: "puntarenas",
    habitat: "Transitional rainforest, river, mangrove edge",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Peak macaw activity; best light; most visitors." },
      { name: "Green Season (May–Nov)", description: "Fewer visitors; better for intermediate species; lusher forest." }
    ],
    targetSpecies: ["scarlet-macaw", "red-crowned-woodpecker", "blue-crowned-motmot", "golden-crowned-manakin", "stripe-backed-antbird"],
    nearbyGalleries: ["birds-macaws-lapas", "tarcoles", "jaco-beach"],
    photographyTips: ["The river checkpoint bridge is the top macaw photography spot; use a 400mm+ lens from a vehicle.", "Arrive at 6:30 AM for the best macaw activity before the park fills."]
  },
  "corcovado-national-park": {
    name: "Corcovado National Park",
    regionSlug: "puntarenas",
    habitat: "Lowland tropical rainforest, lagoon, beach",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Easiest access; wildlife most concentrated near water sources." },
      { name: "Green Season (May–Nov)", description: "Very remote; some trails impassable; dramatic forest photography." }
    ],
    targetSpecies: ["scarlet-macaw", "great-curassow", "jaguarundi"],
    nearbyGalleries: ["wildlife", "forests-of-costa-rica", "birds-macaws-lapas"],
    photographyTips: ["Corcovado requires a guide; photography is best at Sirena station dawn and dusk.", "A 500mm lens minimum is recommended for forest canopy species."]
  },
  "tortuguero-national-park": {
    name: "Tortuguero National Park",
    regionSlug: "limon",
    habitat: "Lowland rainforest, Caribbean beach, canals",
    seasons: [
      { name: "Turtle Season (Jul–Oct)", description: "Sea turtle nesting July–August (green) and September–December (leatherback)." },
      { name: "Dry Season (Sep–Oct)", description: "Driest Caribbean months; best for bird photography in the canals." }
    ],
    targetSpecies: ["great-green-macaw", "keel-billed-toucan", "green-ibis", "sunbittern", "tiger-bittern"],
    nearbyGalleries: ["wildlife", "turtles", "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva"],
    photographyTips: ["Boat photography on the Tortuguero canals at dawn is exceptional for herons and kingfishers.", "Great Green Macaws are most reliably photographed at dawn near feeding trees on the way to the park."]
  },
  "arenal-volcano-national-park": {
    name: "Arenal Volcano National Park",
    regionSlug: "alajuela",
    habitat: "Volcanic forest, lake, highland cloud forest edge",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best volcano views; clearest mornings; most consistent photography weather." },
      { name: "Green Season (May–Nov)", description: "Dramatic cloud formations around the volcano; lusher vegetation." }
    ],
    targetSpecies: ["fiery-throated-hummingbird", "three-wattled-bellbird", "bare-shanked-screech-owl", "black-faced-solitaire"],
    nearbyGalleries: ["arenal-volcano", "wildlife", "forests-of-costa-rica", "landscapes"],
    photographyTips: ["The 1968 lava flow viewpoint at dusk offers the classic Arenal silhouette with foreground vegetation.", "Fiery-throated Hummingbirds visit the private lodges above La Fortuna; arrange photography access in advance."]
  },
  "poas-volcano-national-park": {
    name: "Poas Volcano National Park",
    regionSlug: "alajuela",
    habitat: "Highland cloud forest, paramo, volcanic crater lake",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Most reliable for crater views; hummingbird feeders active." },
      { name: "Cloudy Season (May–Nov)", description: "Crater often obscured by clouds by mid-morning; atmospheric photography." }
    ],
    targetSpecies: ["fiery-throated-hummingbird", "black-bellied-hummingbird", "sooty-robin", "mountain-thrush"],
    nearbyGalleries: ["volcan-poas", "alajuela", "wildlife"],
    photographyTips: ["Reserve your entry time online; the park has limited daily visitors.", "The hummingbird garden near the visitor center is excellent; arrive when the park opens."]
  },
  "san-gerardo-de-dota": {
    name: "San Gerardo de Dota",
    regionSlug: "cartago",
    habitat: "Highland cloud forest, river canyon, wild avocado trees",
    seasons: [
      { name: "Quetzal Season (Mar–May)", description: "Peak breeding display; quetzals most visible and vocal. March is exceptional." },
      { name: "Dry Season (Dec–Apr)", description: "Best overall weather; trail conditions good; most reliable for quetzal." }
    ],
    targetSpecies: ["resplendent-quetzal", "sooty-robin", "long-tailed-silky-flycatcher", "slaty-backed-nightingale-thrush"],
    nearbyGalleries: ["cartago", "birds", "wildlife", "forests-of-costa-rica"],
    photographyTips: ["Quetzals feed on wild avocados at dawn; guides know current feeding trees which change daily.", "Hire a local guide for your first morning; they track the feeding trees daily."]
  },
  "cerro-de-la-muerte": {
    name: "Cerro de la Muerte",
    regionSlug: "cartago",
    habitat: "Highland cloud forest, paramo, highland meadows",
    seasons: [
      { name: "Quetzal Season (Mar–May)", description: "Peak breeding activity; males display at dawn from exposed perches." },
      { name: "Dry Season (Dec–Apr)", description: "Best weather; clearest skies; most reliable for quetzal sightings." }
    ],
    targetSpecies: ["resplendent-quetzal", "sooty-robin", "black-faced-solitaire", "slaty-backed-nightingale-thrush"],
    nearbyGalleries: ["cartago", "birds", "wildlife"],
    photographyTips: ["The first 10km above the paramo checkpoint is the quetzal zone; arrive at 5:30 AM.", "A 400mm lens is ideal; quetzals often at mid-canopy level in wild avocado trees."]
  },
  "puerto-viejo-de-talamanca": {
    name: "Puerto Viejo de Talamanca",
    regionSlug: "limon",
    habitat: "Lowland rainforest, Caribbean coastline, farmland edge",
    seasons: [
      { name: "Dry Season (Sep–Oct)", description: "Driest Caribbean months; best for general wildlife." },
      { name: "Manakin Season (Mar–Jun)", description: "Peak lek activity for White-collared and Red-capped Manakins." }
    ],
    targetSpecies: ["red-capped-manakin", "white-collared-manakkin", "keel-billed-toucan", "violet-crowned-woodnymph"],
    nearbyGalleries: ["limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva", "wildlife"],
    photographyTips: ["Red-capped Manakin leks near Puerto Viejo can be photographed from established blinds.", "The Jaguar Rescue Center area has habituated toucans near fruiting trees."]
  },
  "braulio-carrillo-national-park": {
    name: "Braulio Carrillo National Park",
    regionSlug: "heredia",
    habitat: "Premontane and cloud forest, volcanic slopes",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Most reliable for clear views from the summit; best for hawk photography." },
      { name: "Green Season (May–Nov)", description: "Lush understory; fewer photographers; better for understory species." }
    ],
    targetSpecies: ["white-hawk", "emerald-toucanet", "spangle-cheeked-tropical-bird", "black-headed-nightingale-thrush"],
    nearbyGalleries: ["heredia-costa-rica", "wildlife", "forests-of-costa-rica"],
    photographyTips: ["The park entrance road is excellent for early morning birding; arrive at 5:30 AM.", "Emerald Toucanets regularly cross the road at dawn; a 400mm lens is ideal."]
  },
  "monteverde": {
    name: "Monteverde",
    regionSlug: "puntarenas",
    habitat: "Cloud forest, elfin forest, transition forest",
    seasons: [
      { name: "Quetzal Season (Dec–May)", description: "Best time for Resplendent Quetzal; most reliable sightings at dawn on the Sendero Continental." },
      { name: "Year-round (Jan–Dec)", description: "Hummingbirds present year-round at the feeding stations; 14+ species." },
      { name: "Green Season (May–Nov)", description: "Lush cloud forest; atmospheric mist; fewer photographers." }
    ],
    targetSpecies: ["resplendent-quetzal", "mottled-owl", "black-guan", "three-wattled-bellbird", "emerald-hummingbird"],
    nearbyGalleries: ["arenal-volcano", "heredia-costa-rica", "birds", "rainforests", "landscapes"],
    photographyTips: ["Quetzals most viewable at dawn on the Sendero Continental; hire a guide who tracks daily feeding trees.", "The hummingbird feeders at the private reserves attract 14+ species; a 300mm lens is ideal.", "Fog creates magical atmosphere on the canopy walkway; use a fast shutter for bird-in-flight."]
  },
  "montezuma": {
    name: "Montezuma",
    regionSlug: "puntarenas",
    habitat: "Coastal dry forest, waterfalls, beach",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best overall wildlife photography; beach sunrise for silhouettes." },
      { name: "Green Season (May–Nov)", description: "Lush vegetation; waterfalls at full flow; fewer photographers." }
    ],
    targetSpecies: ["scarlet-macaw", "white-faced-capuchin", "howler-monkey", "brown-pelican", "magnificent-frigatebird"],
    nearbyGalleries: ["montezuma-costa-rica", "isla-tortuga", "santa-teresa-malpais", "beaches", "wildlife"],
    photographyTips: ["Montezuma waterfalls offer excellent macro and splash photography; use a fast shutter for water action.", "Beach sunrise for silhouettes and reflections; arrive 30 minutes before dawn.", "Town has colorful street art for cultural shots; midday light is harsh but best for contrast."]
  },
  "peninsula-de-osa": {
    name: "Peninsula de Osa",
    regionSlug: "puntarenas",
    habitat: "Tropical rainforest, coastal forest, marine environments",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Easiest wildlife photography access; most reliable for macaws and forest wildlife." },
      { name: "Humpback Season (Aug–Oct)", description: "Humpback whales visible from boat; dramatic rainforest coastline photography." },
      { name: "Green Season (May–Nov)", description: "Remote and dramatic; some trails difficult; extraordinary forest photography." }
    ],
    targetSpecies: ["scarlet-macaw", "keel-billed-toucan", "white-faced-capuchin", "humpback-whale", "anhinga"],
    nearbyGalleries: ["peninsula-de-osa", "wildlife", "birds", "rainforests", "marine-life-of-costa-rica"],
    photographyTips: ["Remote access — fly to Drake Bay or take boat from Sierpe; plan logistics well in advance.", "Corcovado National Park is adjacent; Sirena station is the wildlife photography hub.", "Humpback whales August–October; use a 400mm+ lens from a boat for best results."]
  },
  "dominical": {
    name: "Dominical",
    regionSlug: "puntarenas",
    habitat: "Coastal rainforest, beach, surf breaks",
    seasons: [
      { name: "Surf Season (Dec–Mar)", description: "Best surf action photography; consistent waves; vibrant beach atmosphere." },
      { name: "Green Season (May–Nov)", description: "Lush coastal rainforest; Nauyaca Waterfalls at full flow; dramatic photos." },
      { name: "Whale Season (Aug–Oct)", description: "Humpback whales visible from the coast; dramatic surf and whale combos." }
    ],
    targetSpecies: ["scarlet-macaw", "white-faced-capuchin", "humpback-whale", "brown-pelican", "magnificent-frigatebird"],
    nearbyGalleries: ["dominical-and-uvita", "nauyaca-waterfalls", "jaco-beach", "water-sports-and-surfing", "wildlife"],
    photographyTips: ["Nauyaca Waterfalls require hike or horseback; best midday for water photography with a fast shutter.", "Surf shots at dawn when light is soft and surfers catch early waves; 1/500s minimum.", "Humpback whales visible August–October from the coastal bluff; 400mm lens recommended."]
  },
  "jaco-beach": {
    name: "Jaco Beach",
    regionSlug: "puntarenas",
    habitat: "Coastal rainforest, beach, surf breaks",
    seasons: [
      { name: "Surf Season (Dec–Mar)", description: "Best surf photography; consistent waves; vibrant beach atmosphere." },
      { name: "Dry Season (Dec–Apr)", description: "Carara National Park is 15 minutes away; Scarlet Macaws at dusk." }
    ],
    targetSpecies: ["scarlet-macaw", "white-faced-capuchin", "american-crocodile", "brown-pelican", "magnificent-frigatebird"],
    nearbyGalleries: ["jaco-beach", "birds-macaws-lapas", "tarcoles", "playa-hermosa-jaco-garabito", "wildlife"],
    photographyTips: ["Carara National Park is 15 minutes away — Scarlet Macaws most active at dusk at the river bridge.", "Beach sunrise for surfers with silhouette effects; use a long lens for compressed backgrounds.", "Use a fast shutter (1/1000s+) for surf action; protect gear from salt spray."]
  },
  "santa-teresa": {
    name: "Santa Teresa",
    regionSlug: "puntarenas",
    habitat: "Coastal dry forest, beach, surf breaks",
    seasons: [
      { name: "Surf Season (Dec–Mar)", description: "Best waves; consistent offshore wind; iconic Pacific sunset surf photography." },
      { name: "Dry Season (Dec–Apr)", description: "Golden light at sunset; dry forest birds active near beach trail." }
    ],
    targetSpecies: ["scarlet-macaw", "white-faced-capuchin", "howler-monkey", "brown-pelican", "magnificent-frigatebird"],
    nearbyGalleries: ["santa-teresa-malpais", "montezuma-costa-rica", "isla-tortuga", "beaches", "water-sports-and-surfing"],
    photographyTips: ["Sunset over the Pacific for iconic surf shots; use a tripod for long exposures of waves at low tide.", "Wildlife along the beach trail at dawn; howler monkeys and capuchins most active early morning.", "Long exposure wave photography at low tide creates surreal effects; ND filter recommended."]
  },
  "turrialba": {
    name: "Turrialba",
    regionSlug: "cartago",
    habitat: "Highland volcanic forest, river valleys, agricultural land",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best volcano access and views; most reliable for outdoor photography." },
      { name: "Green Season (May–Nov)", description: "Dramatic clouds and rain over the volcano; lush river valleys; rafting photography." }
    ],
    targetSpecies: ["resplendent-quetzal", "emerald-hummingbird", "slaty-tailed-trogon", "collared-aracari", "great-kiskadee"],
    nearbyGalleries: ["volcan-irazu", "cartago", "landscapes", "rivers", "forests-of-costa-rica"],
    photographyTips: ["Check current volcano access before visiting — the crater trail has variable conditions.", "White-water rafting photography requires waterproof housing; dramatic river valley shots from the road.", "Early morning for atmospheric volcano shots; clouds often clear by mid-morning in dry season."]
  }
};

export async function renderLocation(slug: string, env: Env, url: URL): Promise<Response> {
  const loc = LOCATIONS[slug];
  if (!loc) {
    return new Response("Location not found", { status: 404 });
  }

  const regionSlug = loc.regionSlug;
  
  const galleryHtml = (loc.nearbyGalleries || []).map((g: string) => {
    const displayName = g.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return "<a href=\"/gallery/" + g + "\" class=\"gallery-link\" style=\"display:block;padding:0.5rem;background:#f7fafc;border-radius:6px;margin-bottom:0.5rem;text-decoration:none;color:#2c7a7b;font-size:0.9rem;\">" + escapeHtml(displayName) + " &rarr;</a>";
  }).join("\n          ");

  const speciesHtml = (loc.targetSpecies || []).map((s: string) => {
    const displayName = s.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return "<a href=\"/species/" + s + "\" class=\"species-link\" style=\"display:inline-block;background:#e6f4ea;color:#1e7e34;padding:0.25rem 0.6rem;border-radius:4px;font-size:0.8rem;margin:0.2rem;text-decoration:none;\">" + escapeHtml(displayName) + "</a>";
  }).join("\n          ");

  const seasonHtml = (loc.seasons || []).map((s: any) => {
    return `<div style="background:#f7fafc;padding:1rem;border-radius:8px;border-left:4px solid #2c7a7b;margin-bottom:0.75rem;"><strong style="color:#1a365d;">${escapeHtml(s.name)}</strong><p style="margin:0.5rem 0 0;color:#4a5568;font-size:0.9rem;">${escapeHtml(s.description)}</p></div>`;
  }).join("\n        ");

  const tipsHtml = (loc.photographyTips || []).map((t: string) => "<li style=\"margin-bottom:0.5rem;\">" + escapeHtml(t) + "</li>").join("");

  const displayName = loc.name;
  const regionDisplayName = regionSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  
  const pageTitle = displayName + " Birding Guide | WildPhotography";
  const pageDesc = "Birdwatching and wildlife photography at " + displayName + " in " + regionDisplayName + ", Costa Rica. " + (loc.habitat || "Explore target species, best seasons, and photography tips for this location.");
  const canonicalUrl = "https://wildphotography.com/location/" + slug;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDesc.substring(0, 160))}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDesc.substring(0, 155))}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="WildPhotography">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDesc.substring(0, 155))}">
  <link rel="sitemap" type="application/xml" href="/sitemap.xml">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4f8; color: #2d3748; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 1rem; }
    header { background: #1a365d; color: white; padding: 1rem 0; }
    header .container { display: flex; justify-content: space-between; align-items: center; }
    header a { color: white; text-decoration: none; }
    header .logo { font-size: 1.3rem; font-weight: bold; }
    nav a { margin-left: 1.5rem; font-size: 0.95rem; }
    .breadcrumb { padding: 1rem 0 0; color: #718096; font-size: 0.9rem; }
    .breadcrumb a { color: #718096; text-decoration: none; }
    main { padding: 2rem 0; }
    .location-hero { background: white; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .location-hero h1 { color: #1a365d; font-size: 1.8rem; margin-bottom: 0.5rem; }
    .location-hero p { color: #4a5568; font-size: 1.05rem; max-width: 700px; }
    .habitat-tag { display: inline-block; background: #e6f4ea; color: #1e7e34; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; margin-top: 0.75rem; }
    .location-content { display: grid; grid-template-columns: 1fr 320px; gap: 1.5rem; }
    .card { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { color: #1a365d; font-size: 1.1rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0; }
    .card ul { padding-left: 1.5rem; }
    .location-sidebar .card { padding: 1.25rem; }
    .location-sidebar h3 { color: #1a365d; margin-bottom: 0.75rem; font-size: 1rem; }
    .affiliate-block { background: #e6fffa; border-radius: 8px; padding: 1rem; border: 1px solid #2c7a7b; margin-top: 1.5rem; }
    .affiliate-block h4 { color: #1e7e34; margin-bottom: 0.5rem; font-size: 0.95rem; }
    .affiliate-block p { font-size: 0.85rem; color: #4a5568; margin-bottom: 0.75rem; }
    .affiliate-block a { background: #2c7a7b; color: white; padding: 0.5rem 1rem; border-radius: 6px; display: inline-block; font-size: 0.85rem; text-decoration: none; }
    @media (max-width: 768px) { .location-content { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <a href="/" class="logo">WildPhotography</a>
      <nav>
        <a href="/galleries">Galleries</a>
        <a href="/region">Regions</a>
        <a href="/search">Search</a>
      </nav>
    </div>
  </header>
  <div class="container">
    <div class="breadcrumb">
      <a href="/">Home</a> &rsaquo;
      <a href="/region/${regionSlug}">${escapeHtml(regionDisplayName)}</a> &rsaquo;
      <a href="/location">Locations</a> &rsaquo;
      ${escapeHtml(displayName)}
    </div>
    <main>
      <div class="location-hero">
        <h1>${escapeHtml(displayName)} Birding Guide</h1>
        <p>${escapeHtml(loc.habitat || "Wildlife photography in Costa Rica.")}</p>
        <span class="habitat-tag">Habitat: ${escapeHtml(loc.habitat || "Various")}</span>
      </div>
      <div class="location-content">
        <div class="location-main">
          <div class="card">
            <h2>Best Seasons</h2>
            ${seasonHtml}
          </div>
          <div class="card">
            <h2>Photography Tips</h2>
            <ul style="padding-left:1.5rem;">${tipsHtml}</ul>
          </div>
        </div>
        <div class="location-sidebar">
          <div class="card">
            <h3>Target Species (${(loc.targetSpecies || []).length}+)</h3>
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">${speciesHtml}</div>
          </div>
          <div class="card">
            <h3>Photo Galleries</h3>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">${galleryHtml || "<p style=\"color:#718096;font-size:0.9rem;\">No galleries linked yet.</p>"}</div>
          </div>
          <div class="affiliate-block">
            <h4>Plan Your Trip</h4>
            <p>Find guided birding tours at ${escapeHtml(displayName)} and across Costa Rica.</p>
            <a href="/go/gyg/costa-rica-birding-tours" target="_top">Browse Tours</a>
          </div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    }
  });
}
