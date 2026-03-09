/**
 * Galleries page renderer
 */

import { renderPage } from './base';
import type { Env } from '../types';

// TODO: Fetch from Neon DB when Phase B3
const GALLERIES = [
  { slug: 'surfing-costa-rica', name: 'Surfing Costa Rica' },
  { slug: 'rivers', name: 'Rivers' },
  { slug: 'volcan-poas', name: 'Volcan Poas' },
  { slug: 'turtles', name: 'Turtles' },
];

export async function renderGalleries(env: Env, url: URL): Promise<Response> {
  const content = `
    <h2>Photo Galleries</h2>
    <ul class="gallery-list">
      ${GALLERIES.map(g => `
        <li><a href="/gallery/${g.slug}">${g.name}</a></li>
      `).join('')}
    </ul>
  `;
  
  return renderPage('Galleries | Wildphotography', content);
}
