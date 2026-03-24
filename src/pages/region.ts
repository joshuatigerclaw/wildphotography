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

interface RegionData {
  name: string;
  overview: string;
  highlights: string[];
  habitat: string;
  seasons: { name: string; description: string }[];
  gallerySlugs: string[];
  speciesSlugs: string[];
  photographyTips: string[];
  nearbyRegions: { name: string; slug: string; distance: string }[];
}

const REGIONS: Record<string, RegionData> = {
  "guanacaste": {
    name: "Guanacaste",
    overview: "Guanacaste occupies Costa Rica northwest corner, spanning Pacific coastline across tropical dry forest to the volcanic Cordillera de Guanacaste. The landscape transforms dramatically with seasons: parched and golden December through April, then lush and green during the rainy months. This contrast makes Guanacaste one of the most visually distinct regions for photography. The dry season concentrates wildlife around remaining water sources, making April one of the best months for close encounters with White-throated Magpie-Jays and Northern Crested Caracaras.",
    highlights: [
      "Turquoise-browed Motmot — Guanacaste provincial bird, found in forest edge throughout the region",
      "White-throated Magpie-Jay — Common and conspicuous in dry forest and gardens",
      "Scarlet Macaw — Healthy populations in Palo Verde and Santa Rosa",
      "Northern Crested Caracara — Regularly seen along roads and in open areas",
      "Boat-billed Flycatcher — Widespread in forest edge and second growth"
    ],
    habitat: "Tropical dry forest, mangrove wetlands, Pacific shoreline, volcanic foothills",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best overall wildlife photography. Birds concentrate near water; landscape is golden. Peak for motmots, macaws, and flycatchers." },
      { name: "Green Season (May–Nov)", description: "Landscape turns lush green, wildflowers bloom. Fewer photographers, more frogs and insects. Mornings often clearest." },
      { name: "Peak Macaw Season (Feb–Apr)", description: "Scarlet Macaws most visible at clay licks and feeding trees near Palo Verde and the Tempisque basin." }
    ],
    gallerySlugs: ["guanacaste-costa-rica-travel-and-tourism", "conchal-guanacaste", "flamingo-beach", "tamarindo-guanacaste-costa-rica", "las-catalinas-guanacaste", "playa-hermosa-guanacaste", "rincon-de-la-vieja", "peninsula-papagayo", "beaches"],
    speciesSlugs: ["turquoise-browed-motmot", "white-throated-magpie-jay", "scarlet-macaw", "northern-crested-caracara", "boat-billed-flycatcher", "great-kiskadee", "brown-pelican", "magnificent-frigatebird", "royal-tern", "groove-billed-ani", "orange-fronted-parakeet", "white-fronted-amazon"],
    photographyTips: [
      "Arrive at Palo Verde National Park by 6:30 AM to catch macaws at the feeding trees before full sun",
      "The Tempisque River bridge near Palo Verde is excellent for Scarlet Macaw flight shots at sunset",
      "Turquoise-browed Motmots are most reliable in garden and second-growth areas around Lomas Barbudal",
      "Use a 400mm lens for dry forest birds; a 200mm suffices for habituated motmots near hotels"
    ],
    nearbyRegions: [
      { name: "Alajuela", slug: "alajuela", distance: "~2 hours north" },
      { name: "Puntarenas", slug: "punta-renas", distance: "South via ferry or 3-hour road" }
    ]
  },
  "punta-renas": {
    name: "Puntarenas",
    overview: "Puntarenas Province stretches along Costa Rica entire Pacific coast, from the bustling beach town of Jaco in the north to the remote wilderness of the Osa Peninsula in the south, plus the entire Nicoya Peninsula jutting westward. This geographic diversity produces an extraordinary range of photographic subjects: nesting Scarlet Macaws at Carara, humpback whales off the Drake Bay coast, surf photography at Santa Teresa, and the mangrove labyrinths of the Gulf of Nicoya.",
    highlights: [
      "Scarlet Macaw — Carara National Park is the most reliable location in Costa Rica",
      "Red-crowned Woodpecker — Common in coastal forest and around human settlement",
      "Brown Pelican — Year-round along the entire Pacific coastline, diving near fishing boats",
      "Magnificent Frigatebird — Soars over coastal towns and nesting colonies",
      "Bare-throated Tiger-Heron — Found along mangrove channels and river mouths"
    ],
    habitat: "Pacific lowland rainforest, mangrove estuaries, sandy beaches, surf zones, offshore islands",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best for Scarlet Macaw photography at Carara; excellent light; whales visible from Drake Bay December–March." },
      { name: "Green Season (May–Nov)", description: "Osa and Drake Bay more accessible; fewer photographers; dramatic cloud formations over the Pacific." },
      { name: "Macaw Peak (Feb–Apr)", description: "Carara macaws most visible; plan morning sessions at the river checkpoint bridge." }
    ],
    gallerySlugs: ["jaco-beach", "dominical-and-uvita", "isla-san-lucas-puntarenas-costa-rica", "tarcoles", "samara-playa-carillo", "santa-teresa-malpais", "tambor-nicoya-peninsula-costa-rica", "isla-tortuga", "playa-hermosa-guanacaste", "crocodiles", "birds-macaws-lapas"],
    speciesSlugs: ["scarlet-macaw", "red-crowned-woodpecker", "brown-pelican", "magnificent-frigatebird", "bare-throated-tiger-heron", "great-kiskadee", "black-necked-stilt", "willets", "whimbrel", "laughing-falcon", "orange-chinned-parakeet", "blue-crowned-motmot"],
    photographyTips: [
      "Carara National Park: arrive before 7 AM for the best light and most active macaw behavior near the river",
      "The Tarcoles River bridge on the Coastal Highway is one of the best in Costa Rica for Scarlet Macaw flight photography",
      "Offshore islands near Drake Bay offer whale and dolphin photography opportunities between December and March",
      "Use a 500mm+ lens for macaws at distance; 200–400mm works well at the Tarcoles bridge with a vehicle as blind"
    ],
    nearbyRegions: [
      { name: "Guanacaste", slug: "guanacaste", distance: "~1.5 hours north via ferry" },
      { name: "San José", slug: "san-jose", distance: "~2 hours via San Jose" }
    ]
  },
  "san-jose": {
    name: "San José",
    overview: "San Jose Province encompasses Costa Rica capital city and the surrounding Central Valley, a bowl-shaped depression ringed by volcanic mountain ranges at 1,000–1,400 meters elevation. While often overlooked by birders focused on more remote destinations, the San Jose area offers excellent photography opportunities with dramatically less travel time. The capital residential neighborhoods, particularly in Escazu and Santa Ana, maintain green spaces where hummingbirds, tanagers, and flycatchers pose in garden settings.",
    highlights: [
      "Resplendent Quetzal — March through May in the Cerro de la Muerte cloud forest",
      "Rufous-tailed Hummingbird — Ubiquitous in gardens and at feeders year-round",
      "Clay-colored Thrush — Costa Rica national bird, common in urban parks and gardens",
      "Blue-and-white Mockingbird — Often in edge habitat and second growth near urban areas",
      "Yellow-faced Grassquit — Open areas, roadsides, and gardens throughout the region"
    ],
    habitat: "Urban parks and gardens, coffee plantations, premontane forest edge, highland meadows",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Most reliable for photography outings; consistent morning weather; quetzal season March–May." },
      { name: "Quetzal Season (Mar–May)", description: "Best time for quetzal photography in the highlands above San Jose; males display at dawn." },
      { name: "Green Season (May–Nov)", description: "More colorful landscapes; higher humidity reduces clarity for distant subjects." }
    ],
    gallerySlugs: ["san-jose-costa-rica", "la-sabana-estadio-nacional-costa-rica-san-jose", "escazu-costa-rica", "santa-ana-costa-rica", "birds", "wildlife"],
    speciesSlugs: ["resplendent-quetzal", "rufous-tailed-hummingbird", "clay-colored-thrush", "blue-and-white-mockingbird", "yellow-faced-grassquit", "social-flycatcher", "cinnamon-hummingbird", "blue-gray-tanager", "golden-hooded-tanager", "red-legged-honeycreeper", "scripted-tanager", "summer-tanager"],
    photographyTips: [
      "Cerro de la Muerte: the first 10km above the paramo checkpoint is the quetzal zone; arrive at 5:30 AM for dawn displays",
      "Garden hummingbirds in Escazu allow close approach with a 200mm lens; use flash with diffuser for gorget detail",
      "La Paz Waterfall Gardens has well-positioned feeders for hummingbird photography at eye level",
      "La Sabana park in downtown San Jose has habituated Tropical Mockingbirds and Clay-colored Thrushes"
    ],
    nearbyRegions: [
      { name: "Cartago", slug: "cartago", distance: "~45 min east" },
      { name: "Heredia", slug: "heredia", distance: "~30 min north" },
      { name: "Alajuela", slug: "alajuela", distance: "~45 min northwest" }
    ]
  },
  "limon": {
    name: "Limón",
    overview: "Limon Province covers Costa Rica entire Caribbean coastline and the inland Sarapiqui corridor, fundamentally different from the rest of the country. The Caribbean coast receives 3,000–4,000mm of rain annually and maintains a consistently humid atmosphere. The lowland rainforests of Tortuguero, Barra del Colorado, and the Gandoca-Manzanillo Wildlife Refuge support species found nowhere else in Costa Rica, including the endangered Great Green Macaw and the elusive Tiger Bittern.",
    highlights: [
      "Great Green Macaw — Nesting season February–April; most reliable at Barra del Colorado and Tortuguero",
      "Red-capped Manakin — lek displays most active March–June; lek sites accessible near Puerto Viejo",
      "Keel-billed Toucan — Common in lowland rainforest; best photographed at fruiting trees",
      "White-collared Manakin — lek behavior near Puerto Viejo is among Costa Rica best bird photography",
      "American Pygmy Kingfisher — Tiny and elusive in shaded mangrove channels"
    ],
    habitat: "Lowland tropical rainforest, Caribbean mangrove wetlands, sea turtle nesting beaches",
    seasons: [
      { name: "Dry Season (Sep–Oct)", description: "Driest months on the Caribbean side; best for general wildlife photography." },
      { name: "Macaw Nesting (Feb–Apr)", description: "Great Green Macaws most visible at active nest sites; early morning departures." },
      { name: "Manakin Season (Mar–Jun)", description: "Peak lek activity for White-collared and Red-capped Manakins." },
      { name: "Turtle Season (Jul–Oct)", description: "Sea turtle nesting at Tortuguero; green July–August, leatherbacks September–December." }
    ],
    gallerySlugs: ["limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva", "wildlife", "turtles", "forests-of-costa-rica", "rivers"],
    speciesSlugs: ["great-green-macaw", "red-capped-manakin", "white-collared-manakin", "keel-billed-toucan", "turquoise-browed-motmot", "american-pygmy-kingfisher", "tiger-bittern", "green-ibis", "sunbittern", "violet-crowned-woodnymph", "tawny-crested-tyrannulet", "lovely-cotinga"],
    photographyTips: [
      "Great Green Macaw photography: hire a local guide who knows the active nest trees; position at dawn before the birds depart",
      "Red-capped Manakin leks near Puerto Viejo can be photographed from established blinds with a 300–400mm lens",
      "The canals of Tortuguero are best explored by boat at dawn; bring a beanbag and 400mm+ lens",
      "Rain protection for your gear is essential; humidity is consistently above 80% year-round"
    ],
    nearbyRegions: [
      { name: "San José", slug: "san-jose", distance: "~3 hours via Guapiles highway" },
      { name: "Heredia", slug: "heredia", distance: "Via Sarapiqui ~2.5 hours" }
    ]
  },
  "alajuela": {
    name: "Alajuela",
    overview: "Alajuela Province sits in the northern highlands of Costa Rica, anchored by two of the country most iconic volcanoes — Arenal and Poas — plus the lesser-visited volcanoes of the Guanacaste massif to the north. The region spans from the San Carlos plains at 200 meters to the 2,700-meter summit of Poas. Arenal perfectly conical silhouette has made it one of the most photographed landscapes in Central America, while the cloud forests of the higher slopes support species found nowhere else in Costa Rica, including the endemic Fiery-throated Hummingbird, Three-wattled Bellbird, and Bare-shanked Screech-Owl.",
    highlights: [
      "Fiery-throated Hummingbird — Endemic to Costa Rica and western Panama highlands; reliable at Poas and Arenal",
      "Three-wattled Bellbird — One of Costa Rica most sought-after endemics; heard more than seen",
      "Bare-shanked Screech-Owl — Roosts in bamboo and epiphyte clusters in highland forest; guide essential",
      "Black-bellied Hummingbird — Common at higher elevations",
      "Mountain Thrush — Often the most common thrush in cloud forest"
    ],
    habitat: "Highland cloud forest, volcanic landscapes, montane wetlands, lower elevation rainforest",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Best overall weather; clearest views of Arenal Volcano; bellbird and owl most active." },
      { name: "Hummingbird Peak (Mar–May)", description: "Highland hummingbird activity peaks; Fiery-throated most reliable March–April." },
      { name: "Green Season (May–Nov)", description: "Lush landscapes, more dramatic clouds over Arenal." }
    ],
    gallerySlugs: ["alajuela", "arenal-volcano", "volcan-poas", "coyol-de-alajuela", "san-rafael-de-alajuela", "wildlife", "forests-of-costa-rica", "landscapes"],
    speciesSlugs: ["fiery-throated-hummingbird", "three-wattled-bellbird", "bare-shanked-screech-owl", "black-bellied-hummingbird", "mountain-thrush", "black-faced-solitaire", "long-tailed-silky-flycatcher", "sooty-robin", "spangle-cheeked-tropical-bird", "slaty-backed-nightingale-thrush", "black-capped-flycatcher", "olive-starthroat"],
    photographyTips: [
      "Fiery-throated Hummingbirds are most reliable at the Poas Volcano feeders with reservation system",
      "Three-wattled Bellbird: focus on auditory detection first; males call from mid-canopy perches",
      "Arenal: the 1968 lava flow viewpoint at dusk provides dramatic landscape shots with the volcano backdrop",
      "Bring layers: Arenal and Poas at 1,500–2,700m can be cold at dawn"
    ],
    nearbyRegions: [
      { name: "Guanacaste", slug: "guanacaste", distance: "~2 hours via Canas" },
      { name: "San José", slug: "san-jose", distance: "~2 hours via San Ramon" },
      { name: "Heredia", slug: "heredia", distance: "~1 hour via Vara Blanca" }
    ]
  },
  "cartago": {
    name: "Cartago",
    overview: "Cartago Province occupies the eastern slopes of Costa Rica central volcanic backbone, rising from the flat Central Valley floor through the historic colonial city of Cartago to the high paramo of Cerro de la Muerte at nearly 3,000 meters. The area around San Gerardo de Dota and the Savegre Valley has become famous worldwide as one of the most reliable places to see and photograph the Resplendent Quetzal, while the remote Tapanti National Park harbors additional highland specialities including Black-faced Solitaire and Silky-flycatchers.",
    highlights: [
      "Resplendent Quetzal — San Gerardo de Dota and Savegre Valley are among the top quetzal sites globally",
      "Sooty Robin — Endemic subspecies; common in paramo and highland meadows",
      "Long-tailed Silky-flycatcher — Common in highland areas; excellent for flight photography",
      "Black-faced Solitaire — Elusive but photographed in deep forest ravines around Tapanti",
      "Yellow-thighed Brushfinch — Endemic subspecies; common on highland trails"
    ],
    habitat: "Highland cloud forest, paramo, river canyons, highland meadows, coffee-forest edge",
    seasons: [
      { name: "Quetzal Season (Mar–May)", description: "Peak breeding display activity; males most visible and vocal at feeding trees." },
      { name: "Dry Season (Dec–Apr)", description: "Best for trail photography; clearest skies; most consistent morning conditions." },
      { name: "Green Season (May–Nov)", description: "Landscape is very green and lush; wildflowers bloom June–August." }
    ],
    gallerySlugs: ["cartago", "volcan-irazu", "birds", "wildlife", "forests-of-costa-rica", "waterfalls-in-costa-rica"],
    speciesSlugs: ["resplendent-quetzal", "sooty-robin", "long-tailed-silky-flycatcher", "black-faced-solitaire", "slaty-backed-nightingale-thrush", "spangle-cheeked-tropical-bird", "yellow-thighed-brushfinch", "fiery-throated-hummingbird", "talamanca-hummingbird", "pearly-breasted-tanager", "buffy-tufted-cheek", "mountain-whisper"],
    photographyTips: [
      "Quetzal photography in Savegre: hire a guide for the first morning; guides know current feeding tree locations",
      "Tapanti National Park has fewer photographers than Savegre but equal bird density; arrive at 6 AM for best light",
      "Bring rain protection for your camera at all times in Tapanti; the forest is very humid",
      "For quetzal flight shots, use 1/2000s or faster and continuous autofocus tracking"
    ],
    nearbyRegions: [
      { name: "San José", slug: "san-jose", distance: "~45 min via Cartago" },
      { name: "Limón", slug: "limon", distance: "~1.5 hours via Turrialba" },
      { name: "Heredia", slug: "heredia", distance: "~1 hour via Vara Blanca" }
    ]
  },
  "heredia": {
    name: "Heredia",
    overview: "Heredia Province forms the northern rim of Costa Rica Central Valley, a steep volcanic hillside that rises from suburban San Jose into premontane and cloud forest within 30 minutes of the capital. Despite being the smallest and most urbanized of Costa Rica provinces, Heredia harbors a disproportionate share of the country endemic bird species. The Braulio Carillo National Park slopes protect some of the most intact premontane forest in the Central Valley, while the hills around San Rafael de Heredia and the Sarapiqui region offer accessible birding.",
    highlights: [
      "Spangle-cheeked Tropical Bird — Endemic to Costa Rica and western Panama; found in Heredia cloud forests",
      "Silver-throated Tanager — Common in coffee agroforestry and forest edge",
      "Emerald Toucanet — Often seen crossing roads at dawn in Braulio Carillo",
      "Black-headed Nightingale-Thrush — Skulky but photographed on shaded trail edges",
      "White Hawk — Soars over cloud forest canopy"
    ],
    habitat: "Premontane and cloud forest, coffee agroforestry, volcanic peaks, highland pastures",
    seasons: [
      { name: "Dry Season (Dec–Apr)", description: "Most reliable for cloud forest birding; best for hawks and canopy species in clearer air." },
      { name: "Breeding Season (Mar–Jun)", description: "Birds most vocal and visible; endemic species including Spangle-cheeked most active." },
      { name: "Green Season (May–Nov)", description: "Lush forest understory; some trail conditions deteriorate; fewer photographers." }
    ],
    gallerySlugs: ["heredia-costa-rica", "birds", "wildlife", "forests-of-costa-rica", "landscapes", "flowers-plants-trees"],
    speciesSlugs: ["spangle-cheeked-tropical-bird", "silver-throated-tanager", "emerald-toucanet", "black-headed-nightingale-thrush", "white-hawk", "rufous-tailed-hummingbird", "blue-gray-tanager", "red-legged-honeycreeper", "golden-hooded-tanager", "collared-aracari", "stripe-tailed-hawk", "ovejita-primary-forest"],
    photographyTips: [
      "The Braulio Carillo park entrance road is excellent for early morning birding; arrive at 5:30 AM",
      "Coffee plantation edges in San Rafael de Heredia attract tanagers and hummingbirds with minimal hiking",
      "La Selva Biological Station near Sarapiqui: hire a guide; the forest is dense and birding is guide-dependent",
      "A 400mm lens is ideal for cloud forest; a 200mm works for the more habituated edge species"
    ],
    nearbyRegions: [
      { name: "San José", slug: "san-jose", distance: "~30 min via Autopista" },
      { name: "Alajuela", slug: "alajuela", distance: "~45 min via San Ramon" },
      { name: "Limón", slug: "limon", distance: "Via Sarapiqui ~2 hours" }
    ]
  }
};

export async function renderRegion(slug: string, env: Env, url: URL): Promise<Response> {
  const r = REGIONS[slug];
  if (!r) return new Response("Region not found", { status: 404 });

  const speciesHtml = r.speciesSlugs.map(s => {
    const displayName = s.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return "<a href=\"/species/" + s + "\" class=\"species-link\">" + escapeHtml(displayName) + "</a>";
  }).join("\n      ");

  const galleryHtml = r.gallerySlugs.map(g => {
    const displayName = g.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return "<a href=\"/gallery/" + g + "\" class=\"gallery-link\">" + escapeHtml(displayName) + "</a>";
  }).join("\n      ");

  const seasonHtml = r.seasons.map(s => {
    return `<div style="background:#f7fafc;padding:1rem;border-radius:8px;border-left:4px solid #2c7a7b;margin-bottom:0.75rem;"><strong style="color:#1a365d;">${escapeHtml(s.name)}</strong><p style="margin:0.5rem 0 0;color:#4a5568;font-size:0.9rem;">${escapeHtml(s.description)}</p></div>`;
  }).join("\n    ");

  const nearbyHtml = r.nearbyRegions.map(n => {
    return "<a href=\"/region/" + n.slug + "\" class=\"nearby-link\"><strong>" + escapeHtml(n.name) + "</strong> <span>" + escapeHtml(n.distance) + "</span></a>";
  }).join("\n      ");

  const tipsHtml = r.photographyTips.map((t: string) => "<li>" + escapeHtml(t) + "</li>").join("");
  const highlightsHtml = r.highlights.map((h: string) => "<li style=\"margin-bottom:0.5rem;\">" + escapeHtml(h) + "</li>").join("");

  const seoTitle = r.name + " Birding Guide | WildPhotography";
  const seoDesc = "Birdwatching and wildlife photography in " + r.name + ", Costa Rica. " + r.overview.substring(0, 150) + "...";

  const content = `<div class="region-hero">
      <nav style="color:#999;margin-bottom:1rem;font-size:0.9rem;">
        <a href="/" style="color:#999;text-decoration:none;">Home</a> &gt;
        <a href="/region" style="color:#999;text-decoration:none;">Regions</a> &gt;
        ${escapeHtml(r.name)}
      </nav>
      <h1 style="color:#1a365d;margin-bottom:0.5rem;">${escapeHtml(r.name)} Birding Guide</h1>
      <p style="color:#4a5568;font-size:1.1rem;max-width:700px;">${escapeHtml(r.overview.substring(0, 200))}...</p>
      <div style="margin-top:1rem;">
        <span style="display:inline-block;background:#e6f4ea;color:#1e7e34;padding:0.3rem 0.7rem;border-radius:4px;font-size:0.85rem;">
          Habitat: ${escapeHtml(r.habitat)}
        </span>
      </div>
    </div>

    <div class="region-content">
      <div class="region-main">
        <div class="card">
          <h2>Photography Highlights</h2>
          <ul style="padding-left:1.5rem;">${highlightsHtml}</ul>
        </div>
        <div class="card">
          <h2>Best Seasons</h2>
          ${seasonHtml}
        </div>
        <div class="card">
          <h2>Photography Tips</h2>
          <ul style="padding-left:1.5rem;">${tipsHtml}</ul>
        </div>
      </div>
      <div class="region-sidebar">
        <div class="card" style="background:#f0f4f8;">
          <h3 style="color:#1a365d;margin-bottom:1rem;">Target Species (${r.speciesSlugs.length}+)</h3>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
            ${speciesHtml}
          </div>
        </div>
        <div class="card" style="background:#f0f4f8;">
          <h3 style="color:#1a365d;margin-bottom:1rem;">Photo Galleries (${r.gallerySlugs.length}+)</h3>
          <div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${galleryHtml}
          </div>
        </div>
        <div class="card">
          <h3 style="color:#1a365d;margin-bottom:1rem;">Nearby Regions</h3>
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            ${nearbyHtml}
          </div>
        </div>
        <div style="margin-top:1.5rem;padding:1rem;background:#e6fffa;border-radius:8px;border:1px solid #2c7a7b;">
          <h4 style="color:#1e7e34;margin-bottom:0.5rem;">Plan Your Trip</h4>
          <p style="font-size:0.9rem;color:#4a5568;margin-bottom:0.75rem;">Find guided birding tours in ${escapeHtml(r.name)} and across Costa Rica.</p>
          <a href="/go/gyg/costa-rica-birding-tours" style="background:#2c7a7b;color:white;padding:0.5rem 1rem;border-radius:6px;display:inline-block;font-size:0.9rem;">Browse Tours</a>
        </div>
      </div>
    </div>`;

  const extraCss = `.region-hero { margin-bottom: 2rem; }
    .region-content { display: grid; grid-template-columns: 1fr 340px; gap: 2rem; }
    .region-main .card { margin-bottom: 1.5rem; }
    .region-sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .species-link { display:inline-block; margin:0.25rem; padding:0.35rem 0.7rem; background:#e2e8f0; border-radius:4px; text-decoration:none; color:#333; font-size:0.85rem; }
    .species-link:hover { background:#cbd5e0; text-decoration:none; }
    .gallery-link { display:inline-block; padding:0.3rem 0; color:#2c7a7b; text-decoration:none; font-size:0.9rem; border-bottom:1px solid #e2e8f0; }
    .gallery-link:hover { color:#234e52; text-decoration:none; }
    .nearby-link { display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0.75rem; background:white; border-radius:6px; text-decoration:none; color:#333; }
    .nearby-link:hover { background:#e2e8f0; text-decoration:none; }
    .nearby-link span { font-size:0.85rem; color:#666; }
    @media (max-width: 768px) { .region-content { grid-template-columns: 1fr; } }`;

  return layout(seoTitle, content, "", extraCss, {
    canonical: "https://wildphotography.com/region/" + slug,
    description: seoDesc
  });
}

export async function getRegionApi(slug: string, env: Env): Promise<Response> {
  if (slug === 'all') {
    const allRegions = Object.entries(REGIONS).map(([key, r]) => ({ slug: key, ...r }));
    const apiResponse = {
      success: true,
      count: allRegions.length,
      data: allRegions,
      _encoding: "UTF-8",
      _validated: new Date().toISOString()
    };
    return new Response(JSON.stringify(apiResponse), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" }
    });
  }
  const region = REGIONS[slug];
  if (!region) {
    return new Response(JSON.stringify({ error: "Region not found", slug }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  const apiResponse = {
    success: true,
    data: { slug, ...region, _encoding: "UTF-8", _validated: new Date().toISOString() }
  };
  return new Response(JSON.stringify(apiResponse), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" }
  });
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
  "corcovado-national-park": {
    name: "Corcovado National Park",
    regionSlug: "punta-renas",
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
    targetSpecies: ["red-capped-manakin", "white-collared-manakin", "keel-billed-toucan", "violet-crowned-woodnymph"],
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
  }
};

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
