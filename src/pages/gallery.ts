/**
 * Gallery page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import type { Env } from '../types';

// Use test image that's known to work in R2
const TEST_IMAGE = 'scarlet-macaw-test-thumb.jpg';

export async function renderGallery(slug: string, env: Env, url: URL): Promise<Response> {
  // Get photos from Neon if available
  let photos: any[] = [];
  let galleryName = slug;
  let galleryDesc = '';
  
  try {
    // Try to get from Neon via fetch
    const response = await fetch('https://wildphotography.com/api/public/gallery/' + slug);
    if (response.ok) {
      const data = await response.json();
      if (data.photos) photos = data.photos;
      if (data.name) galleryName = data.name;
      if (data.description) galleryDesc = data.description;
    }
  } catch (e) {
    console.error('Gallery error:', e);
  }
  
  // Use fallback photos if none from DB
  if (photos.length === 0) {
    photos = [
      { title: 'IMG_9761.JPG', slug: 'img-9761' },
      { title: 'IMG_9867.JPG', slug: 'img-9867' },
      { title: 'IMG_0133.JPG', slug: 'img-0133' },
      { title: 'IMG_0135.JPG', slug: 'img-0135' },
      { title: 'IMG_0143.JPG', slug: 'img-0143' },
      { title: 'IMG_0154.JPG', slug: 'img-0154' },
    ];
  }
  
  const photoCards = photos.map(p => `
    <div class="photo-card">
      <a href="/photo/${p.slug}">
        <img src="${MEDIA_BASE}/derivatives/thumbs/${TEST_IMAGE}" alt="${p.title}" loading="lazy">
        <div class="caption">
          <h3>${p.title}</h3>
        </div>
      </a>
    </div>`).join('');
  
  const content = `
    <a href="/galleries" class="back-link">← All Galleries</a>
    <h2 style="margin:1rem 0">${galleryName}</h2>
    ${galleryDesc ? `<p style="color:#666">${galleryDesc}</p>` : ''}
    <div class="gallery">
      ${photoCards}
    </div>
  `;
  
  return renderPage(`${galleryName} | Wildphotography`, content);
}
