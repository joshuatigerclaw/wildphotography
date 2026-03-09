/**
 * Galleries page renderer
 */

import { renderPage } from './base';
import { getGalleries } from '../lib/db';
import type { Env } from '../types';

export async function renderGalleries(env: Env, url: URL): Promise<Response> {
  const galleries = await getGalleries();
  
  const content = `
    <h2>Photo Galleries</h2>
    <ul class="gallery-list">
      ${galleries.map(g => `
        <li><a href="/gallery/${g.slug}">${g.name}</a>
        ${g.description ? `<p style="color:#666;font-size:0.9rem">${g.description}</p>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
  
  return renderPage('Galleries | Wildphotography', content);
}
