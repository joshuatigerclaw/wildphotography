import type { Env } from "../types";
import { layout } from "./base";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  "carara-national-park": {
    name: "Carara National Park",
    regionSlug: "punta-renas",
    habitat: "Transitional rainforest, river, mangrove edge",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Peak macaw activity; best light; most visitors." },
      { name: "Green Season (May–Nov)", description: "Fewer visitors; better for intermediate species; lusher forest." }
    ],
    targetSpecies: ["scarlet-macaw", "red-crowned-woodpecker", "blue-crowned-motmot", "golden-crowned-manakin", "stripe-backed-antbird"],
    nearbyGalleries: ["birds-macaws-lapas", "tarcoles", "jaco-beach"],
    photographyTips: ["The river checkpoint bridge is the top macaw photography spot; use a 400mm+ lens from a vehicle.", "Arrive at 6:30 AM for the best macaw activity before the park fills."]
  },
  "monteverde": {
    name: "Monteverde",
    regionSlug: "punta-renas",
    habitat: "Cloud forest, paramo, highland forest",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Most reliable for quetzal sightings; clearest mornings." },
      { name: "Green Season (May–Nov)", description: "Lush forest; fewer photographers; dramatic cloud formations." }
    ],
    targetSpecies: ["resplendent-quetzal", "three-wattled-bellbird", "bare-shanked-screech-owl", "golden-winged-warbler", "black-and-white-silky-flycatcher"],
    nearbyGalleries: ["monteverde", "birds", "wildlife", "forests-of-costa-rica"],
    photographyTips: ["The Monteverde Cloud Forest Reserve is best at dawn; hire a local guide.", "Quetzals are most reliably photographed March–May.", "The Hummingbird Gallery has excellent close-up opportunities."]
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
    photographyTips: ["Boat photography on the Tortuguero canals at dawn is exceptional for herons and kingfishers.", "Great Green Macaws are most reliably photographed at dawn near feeding trees."]
  },
  "montezuma": {
    name: "Montezuma",
    regionSlug: "punta-renas",
    habitat: "Coastal forest, waterfall pools, beach, mangrove",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best wildlife photography; clearest water for waterfall shots." },
      { name: "Green Season (May–Nov)", description: "Lush waterfalls; fewer visitors; dramatic coastal photography." }
    ],
    targetSpecies: ["scarlet-macaw", "white-faced-capuchin", "two-toed-slot", "brown-violet-ear", "long-tailed-tyrant"],
    nearbyGalleries: ["montezuma", "wildlife", "beaches"],
    photographyTips: ["The Monteverde waterfalls are best photographed early morning with a tripod.", "Scarlet Macaws fly over the town at dusk; position at the eastern lookout."]
  },
  "quepos": {
    name: "Quepos",
    regionSlug: "punta-renas",
    habitat: "Pacific coastal forest, marina, mangrove",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best for Manuel Antonio wildlife; most consistent weather." },
      { name: "Green Season (May–Nov)", description: "Lush forest; fewer photographers; dramatic skies." }
    ],
    targetSpecies: ["scarlet-macaw", "white-faced-capuchin", "common-woolly-opossum", "orange-chinned-parakeet", "great-anco"],
    nearbyGalleries: ["quepos", "manuel-antonio", "birds-macaws-lapas", "wildlife"],
    photographyTips: ["Manuel Antonio Park is best at dawn before the crowds; a 400mm lens is ideal.", "The marina area attracts frigatebirds and brown pelicans year-round."]
  },
  "dominical": {
    name: "Dominical",
    regionSlug: "punta-renas",
    habitat: "Pacific coastline, coastal forest, river mouth",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best surf photography and coastal bird life." },
      { name: "Green Season (May–Nov)", description: "Whale watching season June–November; dramatic seascapes." }
    ],
    targetSpecies: ["scarlet-macaw", "magnificent-frigatebird", "brown-pelican", "willets", "turnstones"],
    nearbyGalleries: ["dominical-and-uvita", "birds", "beaches"],
    photographyTips: ["The Dominical river mouth is excellent for wading birds and shorebirds at low tide.", "Sunset shots over the Pacific are exceptional from the Dos Trainas viewpoint."]
  },
  "tamarindo": {
    name: "Tamarindo",
    regionSlug: "guanacaste",
    habitat: "Pacific beach, mangrove estuary, dry forest edge",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best overall wildlife photography; consistent morning light." },
      { name: "Green Season (May–Nov)", description: "Lush estuaries; fewer photographers; dramatic storm photography." }
    ],
    targetSpecies: ["magnificent-frigatebird", "brown-pelican", "royal-tern", "black-necked-stilt", "whimbrel"],
    nearbyGalleries: ["tamarindo-guanacaste-costa-rica", "birds", "beaches"],
    photographyTips: ["The Tamarindo estuary at sunrise is exceptional for shorebirds and mangrove species.", "The Marino Ballena viewpoint offers panoramic coastal shots."]
  },
  "santa-teresa": {
    name: "Santa Teresa",
    regionSlug: "punta-renas",
    habitat: "Pacific surf beach, coastal forest, cliff",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best surf photography; consistent light; clearest water." },
      { name: "Green Season (May–Nov)", description: "Lush vegetation; dramatic waves; fewer visitors." }
    ],
    targetSpecies: ["magnificent-frigatebird", "brown-pelican", "great-kiskadee", "groove-billed-ani", "white-throated-magpie-jay"],
    nearbyGalleries: ["santa-teresa-malpais", "beaches", "birds"],
    photographyTips: ["Sunrise surf shots from the southern beach access are most consistent.", "The Mal Pais lighthouse viewpoint is excellent for panoramic ocean photography."]
  },
  "poas-volcano": {
    name: "Poás Volcano",
    regionSlug: "alajuela",
    habitat: "Highland cloud forest, paramo, volcanic crater lake",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Most reliable for crater views; hummingbird feeders active." },
      { name: "Cloudy Season (May–Nov)", description: "Crater often obscured by mid-morning; atmospheric photography." }
    ],
    targetSpecies: ["fiery-throated-hummingbird", "black-bellied-hummingbird", "sooty-robin", "mountain-thrush"],
    nearbyGalleries: ["volcan-poas", "alajuela", "wildlife"],
    photographyTips: ["Reserve entry time online; the park has limited daily visitors.", "The hummingbird garden near the visitor center is excellent; arrive when the park opens."]
  },
  "arenal-volcano-alajuela": {
    name: "Arenal Volcano",
    regionSlug: "alajuela",
    habitat: "Volcanic forest, lake, highland cloud forest edge",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best volcano views; clearest mornings; most consistent photography weather." },
      { name: "Green Season (May–Nov)", description: "Dramatic cloud formations around the volcano; lusher vegetation." }
    ],
    targetSpecies: ["fiery-throated-hummingbird", "three-wattled-bellbird", "bare-shanked-screech-owl", "black-faced-solitaire"],
    nearbyGalleries: ["arenal-volcano", "wildlife", "forests-of-costa-rica", "landscapes"],
    photographyTips: ["The 1968 lava flow viewpoint at dusk offers the classic Arenal silhouette with foreground vegetation.", "Fiery-throated Hummingbirds visit private lodges above La Fortuna; arrange photography access in advance."]
  },
  "turrialba": {
    name: "Turrialba",
    regionSlug: "cartago",
    habitat: "Volcanic highlands, river canyons, cloud forest",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best for volcano views and river photography." },
      { name: "Green Season (May–Nov)", description: "Dramatic rivers; fewer photographers; lush landscapes." }
    ],
    targetSpecies: ["resplendent-quetzal", "three-wattled-bellbird", "silky-flycatcher", "black-faced-solitaire"],
    nearbyGalleries: ["volcan-irazu", "cartago", "wildlife"],
    photographyTips: ["The Volcán Turrialba access road offers dramatic volcano photography at dawn.", "The Pacuare River viewpoint is excellent for whitewater and canyon photography."]
  },
  "perez-zeledon": {
    name: "Pérez Zeledón",
    regionSlug: "punta-renas",
    habitat: "Highland rainforest, paramo, coffee plantation edge",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best for general wildlife; most reliable weather." },
      { name: "Green Season (May–Nov)", description: "Lushest conditions; dramatic mountain photography." }
    ],
    targetSpecies: ["scarlet-macaw", "great-potoo", "blue-and-white-mockingbird", "buffy-crowned-woodpecker"],
    nearbyGalleries: ["perez-zeledon", "wildlife", "birds"],
    photographyTips: ["The Chirripó mountain road is excellent for highland bird photography.", "Dawn departures from San Isidrio give the best light on the Paramo."]
  },
  "jaco-beach": {
    name: "Jaco Beach",
    regionSlug: "punta-renas",
    habitat: "Pacific coastline, beach, coastal forest",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best beach photography; clearest water; consistent surf shots." },
      { name: "Green Season (May–Nov)", description: "Dramatic surf; fewer visitors; moody coastal seascapes." }
    ],
    targetSpecies: ["scarlet-macaw", "brown-pelican", "magnificent-frigatebird", "great-kiskadee"],
    nearbyGalleries: ["jaco-beach", "birds", "beaches", "tarcoles"],
    photographyTips: ["Sunrise beach shots are most dramatic; tide pools at low tide reveal marine life.", "Carara macaw flights visible from the beach at dawn."]
  },
  "puntarenas": {
    name: "Puntarenas",
    regionSlug: "punta-renas",
    habitat: "Urban waterfront, mangroves, Gulf of Nicoya islands",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best overall wildlife photography; clearest light." },
      { name: "Green Season (May–Nov)", description: "Mangrove photography excellent; fewer tourists." }
    ],
    targetSpecies: ["brown-pelican", "magnificent-frigatebird", "royal-tern", "black-necked-stilt", "great-kiskadee"],
    nearbyGalleries: ["birds", "beaches", "wildlife"],
    photographyTips: ["The Puntarenas promenade at sunset is excellent for pelican and frigatebird photography.", "Boat tours of the Gulf of Nicoya mangroves offer great bird photography."]
  },
  "puerto-viejo-de-talamanca": {
    name: "Puerto Viejo de Talamanca",
    regionSlug: "limon",
    habitat: "Lowland rainforest, Caribbean coastline, farmland edge",
    seasons: [
      { name: "Dry Season (Sep–Oct)", description: "Driest Caribbean months; best for general wildlife." },
      { name: "Manakin Season (Mar–Jun)", description: "Peak lek activity for White-collared and Red-capped Manakins." }
    ],
    targetSpecies: ["red-capped-manakin", "white-collared-manakin", "keel-billed-toucan", "violet-crowned-woodnymph"],
    nearbyGalleries: ["limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva", "wildlife"],
    photographyTips: ["Red-capped Manakin leks near Puerto Viejo can be photographed from established blinds.", "The Jaguar Rescue Center area has habituated toucans near fruiting trees."]
  },
  "punta-uva": {
    name: "Punta Uva",
    regionSlug: "limon",
    habitat: "Caribbean reef, coastal rainforest, sea grape grove",
    seasons: [
      { name: "Dry Season (Sep–Oct)", description: "Best snorkeling photography; clearest Caribbean water." },
      { name: "Green Season (May–Nov)", description: "Lushest coastal forest; dramatic reef photography." }
    ],
    targetSpecies: ["green-ibis", "keel-billed-toucan", "white-collared-manakin", "violet-crowned-woodnymph"],
    nearbyGalleries: ["limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva", "wildlife"],
    photographyTips: ["Underwater photography at the reef is best in calm morning conditions.", "The sea grape grove at sunset is excellent for silhouette photography."]
  },
  "punta-leona": {
    name: "Punta Leona",
    regionSlug: "punta-renas",
    habitat: "Pacific coastline, coastal forest, estuary",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best beach and coastal bird photography." },
      { name: "Green Season (May–Nov)", description: "Lush coastal forest; fewer visitors; dramatic seascapes." }
    ],
    targetSpecies: ["scarlet-macaw", "brown-pelican", "magnificent-frigatebird", "great-kiskadee"],
    nearbyGalleries: ["punta-leona-costa-rica", "birds", "beaches"],
    photographyTips: ["The Punta Leona estate grounds have excellent habituated wildlife.", "The beach is best photographed at dawn with minimal visitors."]
  },
  "tarcoles-river": {
    name: "Tarcoles River",
    regionSlug: "punta-renas",
    habitat: "Mangrove estuary, river mouth, coastal wetlands",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best for crocodile photography; most concentrated wildlife." },
      { name: "Green Season (May–Nov)", description: "Lush mangroves; more bird activity; dramatic skies." }
    ],
    targetSpecies: ["scarlet-macaw", "great-blue-heron", "tiger-heron", "bare-throated-tiger-heron", "american-crocodile"],
    nearbyGalleries: ["tarcoles", "birds-macaws-lapas", "crocodiles"],
    photographyTips: ["The Tarcoles River bridge is one of the top wildlife photography spots in Costa Rica.", "Scarlet Macaw flights are best captured at sunset from the bridge."]
  },
  "peninsula-de-osa": {
    name: "Osa Peninsula",
    regionSlug: "punta-renas",
    habitat: "Lowland tropical rainforest, Pacific coastline, mangrove",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Easiest access; wildlife most concentrated near water sources." },
      { name: "Green Season (May–Nov)", description: "Very remote; some trails impassable; dramatic forest photography." }
    ],
    targetSpecies: ["scarlet-macaw", "great-curassow", "jaguarundi", "tapir"],
    nearbyGalleries: ["corcovado-national-park-costa-rica-photography-guide", "wildlife", "forests-of-costa-rica"],
    photographyTips: ["Coroado requires a guide; photography is best at Sirena station dawn and dusk.", "A 500mm lens minimum is recommended for forest canopy species."]
  },
  "corcovado": {
    name: "Corcovado National Park",
    regionSlug: "punta-renas",
    habitat: "Lowland tropical rainforest, lagoon, beach",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Easiest access; wildlife most concentrated near water sources." },
      { name: "Green Season (May–Nov)", description: "Very remote; some trails impassable; dramatic forest photography." }
    ],
    targetSpecies: ["scarlet-macaw", "great-curassow", "jaguarundi"],
    nearbyGalleries: ["corcovado-national-park-costa-rica-photography-guide", "wildlife", "forests-of-costa-rica"],
    photographyTips: ["Corcovado requires a guide; photography is best at Sirena station dawn and dusk.", "A 500mm lens minimum is recommended for forest canopy species."]
  }
};

export { LOCATIONS };

export async function renderLocation(slug: string, env: Env, url: URL): Promise<Response> {
  const loc = LOCATIONS[slug];
  if (!loc) return new Response("Location not found", { status: 404 });

  const region = loc.regionSlug;

  const seasonHtml = loc.seasons.map(s => {
    return `<div style="background:#f7fafc;padding:1rem;border-radius:8px;border-left:4px solid #2c7a7b;margin-bottom:0.75rem;"><strong style="color:#1a365d;">${escapeHtml(s.name)}</strong><p style="margin:0.5rem 0 0;color:#4a5568;font-size:0.9rem;">${escapeHtml(s.description)}</p></div>`;
  }).join("\n    ");

  const tipsHtml = loc.photographyTips.map((t: string) => "<li>" + escapeHtml(t) + "</li>").join("");

  const speciesHtml = loc.targetSpecies.map(s => {
    const displayName = s.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return "<a href=\"/species/" + s + "\" class=\"species-link\">" + escapeHtml(displayName) + "</a>";
  }).join("\n      ");

  const galleryHtml = loc.nearbyGalleries.map(g => {
    const displayName = g.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return "<a href=\"/gallery/" + g + "\" class=\"gallery-link\">" + escapeHtml(displayName) + "</a>";
  }).join("\n      ");

  const seoTitle = loc.name + " Photography Guide | WildPhotography";
  const seoDesc = "Wildlife and nature photography at " + loc.name + ", Costa Rica. " + loc.habitat + ". Best seasons, target species, and photography tips.";

  const extraCss = `
    .location-hero { background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 3rem 2rem; border-radius: 12px; margin-bottom: 2rem; }
    .location-content { display: grid; grid-template-columns: 1fr 320px; gap: 2rem; }
    .card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
    .species-link { display: inline-block; background: #e6fffa; color: #234e52; padding: 0.3rem 0.7rem; border-radius: 9999px; font-size: 0.85rem; margin: 0.25rem; text-decoration: none; }
    .species-link:hover { background: #b2f5ea; }
    .gallery-link { display: block; padding: 0.5rem 0.75rem; background: #f7fafc; border-radius: 8px; margin-bottom: 0.5rem; text-decoration: none; color: #2d3748; }
    .gallery-link:hover { background: #edf2f7; }
    .region-badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; margin-bottom: 1rem; }
    @media (max-width: 768px) { .location-content { grid-template-columns: 1fr; } }`;

  const content = `
    <div class="location-hero">
      <nav style="color:rgba(255,255,255,0.7);margin-bottom:1rem;font-size:0.9rem;">
        <a href="/" style="color:rgba(255,255,255,0.7);text-decoration:none;">Home</a> &gt;
        <a href="/region/${region}" style="color:rgba(255,255,255,0.7);text-decoration:none;">Regions</a> &gt;
        ${escapeHtml(loc.name)}
      </nav>
      <span class="region-badge">${escapeHtml(region)}</span>
      <h1 style="margin-bottom:0.5rem;">${escapeHtml(loc.name)} Photography Guide</h1>
      <p style="opacity:0.9;font-size:1.1rem;max-width:700px;">${escapeHtml(loc.habitat)}</p>
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
        <div class="card" style="background:#f0f4f8;">
          <h3 style="color:#1a365d;margin-bottom:1rem;">Target Species</h3>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
            ${speciesHtml}
          </div>
        </div>
        <div class="card" style="background:#f0f4f8;">
          <h3 style="color:#1a365d;margin-bottom:1rem;">Nearby Galleries</h3>
          ${galleryHtml}
        </div>
        <div class="card">
          <h3 style="color:#1a365d;margin-bottom:0.5rem;">Region</h3>
          <a href="/region/${region}" style="color:#2c5282;text-decoration:none;font-weight:500;">
            → View ${escapeHtml(region)} Region
          </a>
        </div>
      </div>
    </div>`;

  return layout(seoTitle, content, "", extraCss, {
    canonical: "https://wildphotography.com/location/" + slug,
    description: seoDesc
  });
}

export async function getLocationApi(slug: string, env: Env): Promise<Response> {
  const location = LOCATIONS[slug];
  if (!location) {
    return new Response(JSON.stringify({ error: "Location not found", slug }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  const apiResponse = {
    success: true,
    data: { slug, ...location, _encoding: "UTF-8", _validated: new Date().toISOString() }
  };
  return new Response(JSON.stringify(apiResponse), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" }
  });
}
