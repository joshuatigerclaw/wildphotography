/**
 * Home page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import type { Env } from '../types';

const GALLERY_SLUGS = [
  'surfing-costa-rica',
  'rivers',
  'volcan-poas', 
  'turtles'
];

// Default fallback images (used only when no real data)
const FALLBACK_IMAGES = [
  { title: 'IMG_9761', slug: 'img-9761' },
  { title: 'IMG_9867', slug: 'img-9867' },
  { title: 'IMG_0133', slug: 'img-0133' },
  { title: 'IMG_0143', slug: 'img-0143' },
];

export async function renderHome(env: Env, url: URL): Promise<Response> {
  // Try to get photos from API
  let photos: any[] = [];
  
  try {
    const response = await fetch('https://wildphotography.com/api/public/gallery/surfing-costa-rica');
    if (response.ok) {
      const data = await response.json();
      if (data.photos) {
        photos = data.photos.slice(0, 8);
      }
    }
  } catch (e) {
    console.error('Home error:', e);
  }
  
  // Use fallback if no real photos
  if (photos.length === 0) {
    photos = FALLBACK_IMAGES;
  }
  
  // Generate photo cards with real derivative URLs
  const photoCards = photos.map(p => {
    const thumbUrl = p.thumbUrl || `${MEDIA_BASE}/derivatives/thumbs/${p.slug}-thumbs.jpg`;
    return `
      <div class="photo-card">
        <a href="/photo/${p.slug}">
          <img src="${thumbUrl}" alt="${p.title}" loading="lazy">
          <div class="caption">
            <h3>${p.title}</h3>
          </div>
        </a>
      </div>`;
  }).join('');
  
  // Generate gallery cards using real images when available
  const galleryCards = GALLERY_SLUGS.map((slug, i) => {
    // Use real derivative images for galleries
    const thumbUrl = `${MEDIA_BASE}/derivatives/thumbs/${FALLBACK_IMAGES[i % FALLBACK_IMAGES.length].slug}-thumbs.jpg`;
    const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `
      <div class="photo-card">
        <a href="/gallery/${slug}">
          <img src="${thumbUrl}" alt="${name}">
          <div class="caption">
            <h3>${name}</h3>
          </div>
        </a>
      </div>`;
  }).join('');
  
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
    <section>
      <h2>Galleries</h2>
      <div class="gallery">
        ${galleryCards}
      </div>
    </section>
  `;
  
  return renderPage('Wildphotography | Costa Rica Nature Photography', content);
}
