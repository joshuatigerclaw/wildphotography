import type { Env } from "../types";
import { layout } from "./base";

// Costa Rica's 7 provinces as primary birding regions
const REGIONS = [
  {
    slug: 'guanacaste',
    name: 'Guanacaste',
    description: 'Dry forest landscapes and Pacific coastline in northwest Costa Rica',
    highlights: 'Turquoise-browed Motmot, White-throated Magpie-Jay, Scarlet Macaw',
    coverGallery: 'guanacaste-costa-rica-travel-and-tourism',
    photoCount: 5061,
    bestSeason: 'December - April (dry season)',
    habitat: 'Tropical dry forest, mangroves, Pacific beaches'
  },
  {
    slug: 'punta-renas',
    name: 'Puntarenas',
    description: 'Pacific coast from Jacó to the Osa Peninsula, including the Nicoya Peninsula',
    highlights: 'Scarlet Macaw, Red-crowned Woodpecker, Brown Pelican',
    coverGallery: 'jaco-beach',
    photoCount: 3402,
    bestSeason: 'December - April for macaws, year-round for coast',
    habitat: 'Pacific coastline, mangrove estuaries, lowland rainforest'
  },
  {
    slug: 'san-jose',
    name: 'San José',
    description: 'Costa Rica\'s capital region including the Central Valley and surrounding hills',
    highlights: 'Resplendent Quetzal, Rufous-tailed Hummingbird, Clay-colored Thrush',
    coverGallery: 'san-jose-costa-rica',
    photoCount: 661,
    bestSeason: 'March - May for quetzal breeding',
    habitat: 'Highland cloud forest edges, urban gardens, coffee plantations'
  },
  {
    slug: 'limon',
    name: 'Limón',
    description: 'Caribbean coast and lowland rainforest of eastern Costa Rica',
    highlights: 'Great Green Macaw, Red-capped Manakin, Keel-billed Toucan',
    coverGallery: 'limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva',
    photoCount: 983,
    bestSeason: 'February - April for Great Green Macaw nesting',
    habitat: 'Lowland rainforest, Caribbean wetlands, coral reefs'
  },
  {
    slug: 'alajuela',
    name: 'Alajuela',
    description: 'Northern highlands including Arenal Volcano and Poás Volcano regions',
    highlights: 'Fiery-throated Hummingbird, Three-wattled Bellbird, Bare-shanked Screech-Owl',
    coverGallery: 'alajuela',
    photoCount: 384,
    bestSeason: 'December - April, Arenal year-round',
    habitat: 'Cloud forest, volcanic landscapes, highland wetlands'
  },
  {
    slug: 'cartago',
    name: 'Cartago',
    description: 'The highlands east of San José including the famous Cerro de la Muerte',
    highlights: 'Resplendent Quetzal, Sooty Robin, Black-faced Solitaire',
    coverGallery: 'cartago',
    photoCount: 116,
    bestSeason: 'March - May for quetzal breeding displays',
    habitat: 'Highland cloud forest, páramo, river canyons'
  },
  {
    slug: 'heredia',
    name: 'Heredia',
    description: 'Highland cloud forests in the Central Valley\'s northern hills',
    highlights: 'Spangle-cheeked Tropical Bird, Silver-throated Tanager, Emerald Toucanet',
    coverGallery: 'heredia-costa-rica',
    photoCount: 11,
    bestSeason: 'December - April for cloud forest species',
    habitat: 'Premontane and cloud forest, volcanic peaks'
  }
];

export async function renderRegionIndex(env: Env, url: URL): Promise<Response> {
  const regionCards = REGIONS.map(r => `
    <a href="/region/${r.slug}" class="card" style="text-decoration: none;">
      <div class="card-content">
        <div class="card-title">${escapeHtml(r.name)}</div>
        <div class="card-desc">${escapeHtml(r.description)}</div>
        <div style="margin-top: 0.75rem;">
          <span style="display: inline-block; background: #e6f4ea; color: #1e7e34; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.8rem; margin-right: 0.5rem;">
            ${r.photoCount.toLocaleString()} photos
          </span>
          <span style="font-size: 0.85rem; color: #666;">
            Best: ${escapeHtml(r.bestSeason)}
          </span>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #2c7a7b; font-weight: 500;">
          Target: ${escapeHtml(r.highlights)}
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #888;">
          Habitat: ${escapeHtml(r.habitat)}
        </div>
        <span class="card-link">Explore Region →</span>
      </div>
    </a>
  `).join('');

  const heroText = `
    <p style="margin-bottom: 2rem; color: #555; max-width: 700px; margin-left: auto; margin-right: auto;">
      Costa Rica hosts over 900 bird species across dramatically varied habitats — from Pacific dry forests 
      to Caribbean rainforests, highland cloud forests to volcanic peaks. Each province offers distinct 
      photographic opportunities shaped by elevation, rainfall, and conservation status.
    </p>
  `;

  const content = `
    <h1 class="section-title">Birding Regions of Costa Rica</h1>
    ${heroText}
    <div class="card-grid">
      ${regionCards}
    </div>
    <div style="margin-top: 3rem; padding: 1.5rem; background: #f0f4f8; border-radius: 8px;">
      <h2 style="font-size: 1.2rem; margin-bottom: 1rem; color: #1a365d;">Planning a Costa Rica Bird Photography Trip?</h2>
      <p style="color: #555; margin-bottom: 1rem;">
        Each region page includes specific photography locations, seasonal tips, target species guides, 
        and gallery links to help you plan your shoot. Browse by region or explore specific species pages.
      </p>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <a href="/species" style="background: #2c7a7b; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500;">Browse All Species</a>
        <a href="/galleries" style="background: #2c5282; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500;">Photo Galleries</a>
      </div>
    </div>
  `;

  return layout(
    'Costa Rica Birding Regions - WildPhotography',
    content,
    '',
    '',
    {
      canonical: 'https://wildphotography.com/region',
      description: 'Explore Costa Rica\'s best birding regions: Guanacaste, Puntarenas, San José, Limón, Alajuela, Cartago, and Heredia. Photography guides, target species, and gallery links.'
    }
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
