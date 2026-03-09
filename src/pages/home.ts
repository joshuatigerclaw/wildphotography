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

// Use working derivative - the only one that works via worker
const WORKING_IMAGE = 'scarlet-macaw-test';

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
    photos = [
      { title: 'Surfing Costa Rica', slug: WORKING_IMAGE },
      { title: 'Ocean Sunset', slug: WORKING_IMAGE },
      { title: 'Wildlife', slug: WORKING_IMAGE },
      { title: 'Costa Rica', slug: WORKING_IMAGE },
    ];
  }
  
  // Generate photo cards - use working image
  const photoCards = photos.map((p, i) => {
    const slug = p.slug || WORKING_IMAGE;
    const title = p.title || 'Photo';
    const thumbUrl = `${MEDIA_BASE}/derivatives/thumbs/${slug}-thumb.jpg`;
    return `
      <div class="photo-card">
        <a href="/photo/${slug}">
          <img src="${thumbUrl}" alt="${title}" loading="lazy">
          <div class="caption">
            <h3>${title}</h3>
          </div>
        </a>
      </div>`;
  }).join('');  
  
  // Gallery cards - use working image
  const galleryImages = [
    { slug: WORKING_IMAGE, name: 'Surfing Costa Rica' },
    { slug: WORKING_IMAGE, name: 'Rivers' },
    { slug: WORKING_IMAGE, name: 'Volcan Poas' },
    { slug: WORKING_IMAGE, name: 'Turtles' },
  ];
  
  const galleryCards = GALLERY_SLUGS.map((slug, i) => {
    const img = galleryImages[i] || galleryImages[0];
    const thumbUrl = `${MEDIA_BASE}/derivatives/thumbs/${img.slug}-thumb.jpg`;
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
