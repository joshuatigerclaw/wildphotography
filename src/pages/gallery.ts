/**
 * Gallery page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import type { Env } from '../types';

export async function renderGallery(slug: string, env: Env, url: URL): Promise<Response> {
  // TODO: Fetch from Neon DB when Phase B3
  // const gallery = await getGalleryBySlug(slug);
  // const photos = await getPhotosByGallery(gallery.id);
  
  const content = `
    <a href="/galleries" class="back-link">← All Galleries</a>
    <h2 style="margin:1rem 0">${slug}</h2>
    <div class="gallery">
      ${[1,2,3,4,5,6].map(i => `
      <div class="photo-card">
        <img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="Photo ${i}" loading="lazy">
        <div class="caption">
          <h3>Sample Photo ${i}</h3>
        </div>
      </div>`).join('')}
    </div>
  `;
  
  return renderPage(`${slug} | Wildphotography`, content);
}
