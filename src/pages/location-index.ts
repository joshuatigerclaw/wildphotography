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

// Top photography locations in Costa Rica
const LOCATIONS = [
  { slug: 'carara-national-park', name: 'Carara National Park', region: 'Puntarenas', habitat: 'Transitional rainforest, river', highlights: 'Scarlet Macaw, Red-crowned Woodpecker' },
  { slug: 'monteverde', name: 'Monteverde Cloud Forest', region: 'Puntarenas', habitat: 'Cloud forest, páramo', highlights: 'Resplendent Quetzal, Three-wattled Bellbird' },
  { slug: 'tortuguero-national-park', name: 'Tortuguero National Park', region: 'Limón', habitat: 'Lowland rainforest, canals', highlights: 'Great Green Macaw, Keel-billed Toucan' },
  { slug: 'montezuma', name: 'Montezuma', region: 'Puntarenas', habitat: 'Coastal forest, waterfalls', highlights: 'Scarlet Macaw, White-faced Capuchin' },
  { slug: 'quepos', name: 'Quepos / Manuel Antonio', region: 'Puntarenas', habitat: 'Pacific coastal forest', highlights: 'Scarlet Macaw, White-faced Capuchin' },
  { slug: 'dominical', name: 'Dominical', region: 'Puntarenas', habitat: 'Pacific coastline, coastal forest', highlights: 'Scarlet Macaw, Magnificent Frigatebird' },
  { slug: 'tamarindo', name: 'Tamarindo', region: 'Guanacaste', habitat: 'Pacific beach, mangrove estuary', highlights: 'Magnificent Frigatebird, Brown Pelican' },
  { slug: 'santa-teresa', name: 'Santa Teresa', region: 'Puntarenas', habitat: 'Pacific surf beach, cliff', highlights: 'Magnificent Frigatebird, Brown Pelican' },
  { slug: 'poas-volcano', name: 'Poás Volcano', region: 'Alajuela', habitat: 'Highland cloud forest, volcanic crater', highlights: 'Fiery-throated Hummingbird, Sooty Robin' },
  { slug: 'arenal-volcano-alajuela', name: 'Arenal Volcano', region: 'Alajuela', habitat: 'Volcanic forest, cloud forest edge', highlights: 'Fiery-throated Hummingbird, Three-wattled Bellbird' },
  { slug: 'turrialba', name: 'Turrialba', region: 'Cartago', habitat: 'Volcanic highlands, river canyons', highlights: 'Resplendent Quetzal, Three-wattled Bellbird' },
  { slug: 'perez-zeledon', name: 'Pérez Zeledón', region: 'Puntarenas', habitat: 'Highland rainforest, páramo', highlights: 'Scarlet Macaw, Great Potoo' },
  { slug: 'jaco-beach', name: 'Jacó Beach', region: 'Puntarenas', habitat: 'Pacific coastline, coastal forest', highlights: 'Scarlet Macaw, Brown Pelican' },
  { slug: 'puntarenas', name: 'Puntarenas', region: 'Puntarenas', habitat: 'Urban waterfront, mangroves', highlights: 'Brown Pelican, Magnificent Frigatebird' },
  { slug: 'puerto-viejo-de-talamanca', name: 'Puerto Viejo de Talamanca', region: 'Limón', habitat: 'Lowland rainforest, Caribbean coast', highlights: 'Red-capped Manakin, Keel-billed Toucan' },
  { slug: 'punta-uva', name: 'Punta Uva', region: 'Limón', habitat: 'Caribbean reef, coastal rainforest', highlights: 'Green Ibis, Keel-billed Toucan' },
  { slug: 'punta-leona', name: 'Punta Leona', region: 'Puntarenas', habitat: 'Pacific coastline, coastal forest', highlights: 'Scarlet Macaw, Brown Pelican' },
  { slug: 'tarcoles-river', name: 'Tarcoles River', region: 'Puntarenas', habitat: 'Mangrove estuary, river mouth', highlights: 'Scarlet Macaw, American Crocodile' },
  { slug: 'peninsula-de-osa', name: 'Osa Peninsula', region: 'Puntarenas', habitat: 'Lowland rainforest, Pacific coast', highlights: 'Scarlet Macaw, Great Curassow' },
  { slug: 'corcovado', name: 'Corcovado National Park', region: 'Puntarenas', habitat: 'Lowland tropical rainforest', highlights: 'Scarlet Macaw, Great Curassow, Jaguarundi' },
];

export async function renderLocationIndex(env: Env, url: URL): Promise<Response> {
  const locationCards = LOCATIONS.map(l => `
    <a href="/location/${l.slug}" class="card" style="text-decoration: none;">
      <div class="card-content">
        <div class="card-title">${escapeHtml(l.name)}</div>
        <div class="card-desc">${escapeHtml(l.region)} · ${escapeHtml(l.habitat)}</div>
        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #2c7a7b; font-weight: 500;">
          Target: ${escapeHtml(l.highlights)}
        </div>
        <span class="card-link">View Location →</span>
      </div>
    </a>
  `).join('');

  const content = `
    <h1 class="section-title">Photography Locations in Costa Rica</h1>
    <p style="margin-bottom: 2rem; color: #555; max-width: 700px; margin-left: auto; margin-right: auto;">
      Costa Rica's diverse ecosystems offer exceptional wildlife photography across Pacific coastlines,
      Caribbean rainforests, highland cloud forests, and volcanic landscapes. Each location page includes
      seasonal tips, target species, and nearby galleries.
    </p>
    <div class="card-grid">
      ${locationCards}
    </div>
    <div style="margin-top: 3rem; padding: 1.5rem; background: #f0f4f8; border-radius: 8px;">
      <h2 style="font-size: 1.2rem; margin-bottom: 1rem; color: #1a365d;">Planning a Costa Rica Photography Trip?</h2>
      <p style="color: #555; margin-bottom: 1rem;">
        Each location page includes specific photography tips, best seasons, target species, and links to
        relevant galleries. You can also <a href="/region">browse by region</a> for a broader overview.
      </p>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <a href="/region" style="background: #2c7a7b; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500;">Browse by Region</a>
        <a href="/galleries" style="background: #2c5282; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500;">Photo Galleries</a>
      </div>
    </div>
  `;

  return layout(
    'Photography Locations in Costa Rica - WildPhotography',
    content,
    '',
    '',
    {
      canonical: 'https://wildphotography.com/location',
      description: 'Best wildlife photography locations in Costa Rica: Carara, Monteverde, Tortuguero, Corcovado, and more. Seasonal tips, target species, and photography guides.'
    }
  );
}
