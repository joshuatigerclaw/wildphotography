/**
 * Home page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import { getRecentPhotos } from '../lib/db';
import type { Env } from '../types';

export async function renderHome(env: Env, url: URL): Promise<Response> {
  const neonToken = (env as any).NEON_TOKEN || '';
  const photos = await getRecentPhotos(8, neonToken);
  
  const photoCards = photos.length > 0 
    ? photos.map(p => `
        <div class="photo-card">
          <img src="${MEDIA_BASE}/derivatives/thumbs/${p.filename.replace('.jpg', '-thumb.jpg')}" alt="${p.title}" loading="lazy">
          <div class="caption">
            <h3>${p.title}</h3>
            <p>${p.description || ''}</p>
          </div>
        </div>`).join('')
    : `<p>No photos yet. Import from SmugMug to populate.</p>`;
  
  const content = `
    <section class="hero">
      <h2>Welcome</h2>
      <p>Professional wildlife and nature photography from Costa Rica</p>
    </section>
    <section>
      <h2>Featured Photos</h2>
      <div class="gallery">
        ${photoCards}
      </div>
    </section>
  `;
  
  return renderPage('Wildphotography | Costa Rica Nature Photography', content);
}
