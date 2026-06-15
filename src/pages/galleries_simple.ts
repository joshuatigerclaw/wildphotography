/**
 * Gallery index - production ready, no LATERAL joins
 */
import { layout } from './base';
import type { Env } from '../types';
import { queryNeon } from '../lib/db';

export async function renderGalleries(env: Env): Promise<Response> {
  const rows = await queryNeon<any>`
    SELECT id, slug, name, description
    FROM galleries
    WHERE is_active = true
    ORDER BY sort_order NULLS LAST, name
    LIMIT 100
  `;

  const cards = rows.map(g => {
    const title = g.name || 'Gallery';
    const slug = g.slug;
    const desc = ((g.description || '').trim());
    const descHtml = desc ? '<p>' + (desc.length > 60 ? desc.substring(0,60)+'...' : desc) + '</p>' : '';
    return '<a href="/gallery/' + slug + '" class="c"><div class="i"><div class="ph"></div></div><div class="t"><h3>' + title + '</h3>' + descHtml + '</div></a>';
  }).join('');

  const css = '.h{text-align:center;padding:2rem 1rem}.h h1{font-size:2.25rem;font-weight:700;margin:0 0 .5rem;color:#1a1a1a}.h p{font-size:1rem;color:#666;margin:0}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;padding:1.5rem 2rem;max-width:1100px;margin:0 auto}.c{background:#fff;border-radius:10px;overflow:hidden;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:transform .2s,box-shadow .2s;display:block}.c:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.12)}.i{aspect-ratio:4/3;background:#e8e8e8}.i .ph{width:100%;height:100%;background:linear-gradient(135deg,#e0e0e0,#c8c8c8)}.t{padding:.875rem 1rem}.t h3{font-size:.95rem;font-weight:600;margin:0 0 .35rem;color:#1a1a1a;line-height:1.3}.t p{font-size:.8rem;color:#666;margin:0;line-height:1.4}@media(max-width:600px){.g{grid-template-columns:repeat(2,1fr);padding:1rem;gap:.75rem}}';

  const content = '<div class="h"><h1>Photo Galleries</h1><p>Curated nature photography from Costa Rica.</p></div><div class="g">' + cards + '</div>';
  const resp = layout('Photo Galleries | Wildphotography', content, '', css, {
    canonical: 'https://wildphotography.com/galleries',
    description: 'Browse curated photo galleries from Costa Rica.'
  });
  resp.headers.set('Cache-Control', 'public, max-age=120, s-maxage=300');
  return resp;
}
