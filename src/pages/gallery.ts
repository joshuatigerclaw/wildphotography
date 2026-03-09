/**
 * Gallery page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import type { Env } from '../types';

// Use existing derivative filenames with nice titles
const FALLBACK_PHOTOS = [
  { title: 'Surfing Wave', slug: 'img_9761' },
  { title: 'Ocean Sunset', slug: 'img_9919' },
  { title: 'Bird in Flight', slug: 'img_5375' },
  { title: 'Costa Rica Landscape', slug: 'img_3491' },
];

export async function renderGallery(slug: string, env: Env, url: URL): Promise<Response> {
  // Get photos from API
  let photos: any[] = [];
  let galleryName = slug;
  let galleryDesc = '';
  
  try {
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
  
  // Use fallback if no photos from API
  if (photos.length === 0) {
    photos = FALLBACK_PHOTOS;
  }
  
  const photoCards = photos.map((p, i) => {
    const fallback = FALLBACK_PHOTOS[i % FALLBACK_PHOTOS.length];
    const title = p.title || fallback.title;
    const slugVal = p.slug || fallback.slug;
    const thumbUrl = `${MEDIA_BASE}/derivatives/thumbs/${slugVal}-thumbs.jpg`;
    return `
    <div class="photo-card">
      <a href="/photo/${slugVal}">
        <img src="${thumbUrl}" alt="${title}" loading="lazy">
        <div class="caption">
          <h3>${title}</h3>
        </div>
      </a>
    </div>`;
  }).join('');
  
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
