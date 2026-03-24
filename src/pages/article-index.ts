import type { Env } from "../types";
import { layout } from "./base";
import { queryNeon } from "../lib/db";

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  species_guide: "Species Guide",
  location_guide: "Location Guide",
  photography_guide: "Photography Guide",
  itinerary: "Itinerary",
  gear_guide: "Gear Guide",
};

export async function renderArticleIndex(env: Env, url: URL): Promise<Response> {
  // Fetch published articles from DB first, then draft articles
  const rows = await queryNeon<any>(`
    SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt, ca.status,
           p.thumb_url, p.small_url
    FROM content_articles ca
    LEFT JOIN photos p ON p.id = ca.featured_photo_id
    ORDER BY
      CASE WHEN ca.status = 'published' THEN 0 ELSE 1 END,
      ca.updated_at DESC
    LIMIT 20
  `);

  const cards = rows.map((a: any) => {
    const typeLabel = ARTICLE_TYPE_LABELS[a.article_type] || 'Guide';
    const excerpt = (a.excerpt || '').substring(0, 80) + ((a.excerpt || '').length > 80 ? '...' : '');
    return `
      <a href="/article/${a.slug}" class="card">
        <div class="card-content">
          <div class="card-type">${typeLabel}</div>
          <div class="card-title">${a.title}</div>
          ${excerpt ? `<div class="card-desc">${excerpt}</div>` : ''}
          ${a.status !== 'published' ? `<div class="card-status">Draft</div>` : ''}
          <span class="card-link">Read More -></span>
        </div>
      </a>
    `;
  }).join('');

  const articleCount = rows.length;

  const content = `
    <h1 class="section-title">Travel Guides & Photography Articles</h1>
    <p style="margin-bottom: 2rem; color: #666;">Expert guides for wildlife photography and birdwatching in Costa Rica by Joshua ten Brink.</p>
    ${articleCount > 0 ? `<div class="card-grid">${cards}</div>` : '<p style="color:#888;">No articles published yet.</p>'}
  `;

  const css = `
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; padding: 0 2rem 2rem; max-width: 1100px; margin: 0 auto; }
    .card { background: #fff; border-radius: 10px; overflow: hidden; text-decoration: none; box-shadow: 0 1px 4px rgba(0,0,0,.08); transition: transform .2s,box-shadow .2s; display: block; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.12); }
    .card-content { padding: 1.25rem; }
    .card-type { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #2c7a7b; font-weight: 600; margin-bottom: 0.4rem; }
    .card-title { font-size: 1.1rem; font-weight: 600; color: #1a1a1a; margin-bottom: 0.5rem; line-height: 1.3; }
    .card-desc { font-size: 0.85rem; color: #666; line-height: 1.4; margin-bottom: 0.5rem; }
    .card-status { display: inline-block; font-size: 0.7rem; background: #fef3c7; color: #92400e; padding: 0.2rem 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; }
    .card-link { color: #2c7a7b; font-weight: 500; font-size: 0.9rem; }
    .section-title { font-size: 2rem; font-weight: 700; text-align: center; margin: 2rem 0 0.5rem; color: #1a1a1a; }
  `;

  return layout(
    'Articles & Guides - WildPhotography',
    content,
    '',
    css,
    { canonical: 'https://wildphotography.com/article' }
  );
}
