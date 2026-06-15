/**
 * Galleries page — simple query first, LATERAL cover photo deferred
 */

import { layout } from './base';
import type { Env } from '../types';
import { queryNeon } from '../lib/db';

export async function renderGalleries(env: Env, url: URL): Promise<Response> {
  const LIMIT = 24;
  const OFFSET = parseInt(url.searchParams.get('offset') || '0', 10);

  // Simple galleries query — no LATERAL join (avoids Neon timeout issues)
  const rows = await queryNeon<any>`
    SELECT g.id, g.slug, g.name, g.description, g.cover_photo_id
    FROM galleries g
    WHERE g.is_active = true
    ORDER BY g.name
    LIMIT ${LIMIT}
    OFFSET ${OFFSET}
  `;

  const cards = rows.map(g => {
    const title = g.name || 'Gallery';
    const slug = g.slug;
    const description = (g.description || '').trim();
    const descText = description.length > 60 ? description.substring(0, 60) + '...' : description;
    const descHtml = descText ? '<p>' + descText + '</p>' : '';
    return '<a href="/gallery/' + slug + '" class="c"><div class="i"><div class="ph"></div></div><div class="t"><h3>' + title + '</h3>' + descHtml + '</div></a>';
  }).join('');

  const content = '<div class="h"><h1>Photo Galleries</h1><p>Curated nature photography from Costa Rica.</p></div><div class="g">' + cards + '</div>';
  const css = '.h{text-align:center;padding:2rem 1rem}.h h1{font-size:2.25rem;font-weight:700;margin:0 0 .5rem;color:#1a1a1a}.h p{font-size:1rem;color:#666;margin:0}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;padding:1.5rem 2rem;max-width:1100px;margin:0 auto}.c{background:#fff;border-radius:10px;overflow:hidden;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:transform .2s,box-shadow .2s;display:block}.c:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.12)}.i{aspect-ratio:4/3;background:#e8e8e8}.i .ph{width:100%;height:100%;background:linear-gradient(135deg,#e0e0e0,#c8c8c8)}.t{padding:.875rem 1rem}.t h3{font-size:.95rem;font-weight:600;margin:0 0 .35rem;color:#1a1a1a;line-height:1.3}.t p{font-size:.8rem;color:#666;margin:0;line-height:1.4}@media(max-width:600px){.g{grid-template-columns:repeat(2,1fr);padding:1rem;gap:.75rem}.h h1{font-size:1.75rem}.t{padding:.6rem .75rem}.t h3{font-size:.85rem}}';

  const response = layout('Photo Galleries | Wildphotography', content, '', css, {
    canonical: 'https://wildphotography.com/galleries',
    description: 'Browse curated photo galleries featuring wildlife, landscapes, and nature photography from Costa Rica by Joshua ten Brink.'
  });
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
  return response;
}