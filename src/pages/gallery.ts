/**
 * Gallery page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import { getGalleryBySlug, getPhotosByGallery } from '../lib/db';
import type { Env } from '../types';

export async function renderGallery(slug: string, env: Env, url: URL): Promise<Response> {
  const gallery = await getGalleryBySlug(slug);
  const photos = await getPhotosByGallery(slug);
  
  const galleryName = gallery?.name || slug;
  
  const photoCards = photos.length > 0
    ? photos.map(p => `
      <div class="photo-card">
        <img src="${MEDIA_BASE}/derivatives/thumbs/${p.filename.replace('.jpg', '-thumb.jpg')}" alt="${p.title}" loading="lazy">
        <div class="caption">
          <h3>${p.title}</h3>
        </div>
      </div>`).join('')
    : `<p>No photos in this gallery yet.</p>`;
  
  const content = `
    <a href="/galleries" class="back-link">← All Galleries</a>
    <h2 style="margin:1rem 0">${galleryName}</h2>
    ${gallery?.description ? `<p style="color:#666">${gallery.description}</p>` : ''}
    <div class="gallery">
      ${photoCards}
    </div>
  `;
  
  return renderPage(`${galleryName} | Wildphotography`, content);
}
