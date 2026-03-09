/**
 * Home page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import type { Env } from '../types';

export async function renderHome(env: Env, url: URL): Promise<Response> {
  // TODO: Fetch from Neon DB when Phase B3
  // const photos = await getRecentPhotos();
  
  const content = `
    <section class="hero">
      <h2>Welcome</h2>
      <p>Professional wildlife and nature photography from Costa Rica</p>
    </section>
    <section>
      <h2>Featured Photos</h2>
      <div class="gallery">
        ${[1,2,3,4].map(i => `
        <div class="photo-card">
          <img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="Scarlet Macaw ${i}" loading="lazy">
          <div class="caption">
            <h3>Scarlet Macaw</h3>
            <p>Costa Rica's most iconic bird</p>
          </div>
        </div>`).join('')}
      </div>
    </section>
  `;
  
  return renderPage('Wildphotography | Costa Rica Nature Photography', content);
}
