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

// Use actual derivative filenames that exist in R2
const FALLBACK_IMAGES = [
  { title: 'Surfing Costa Rica', slug: 'img_9761' },
  { title: 'Ocean Sunset', slug: 'img_9919' },
  { title: 'Wildlife', slug: 'img_5375' },
  { title: 'Costa Rica', slug: 'img_3491' },
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
  
  // Generate photo cards - use slug directly
  const photoCards = photos.map((p, i) => {
    const slug = p.slug || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length].slug;
    const title = p.title || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length].title;
    const thumbUrl = `${MEDIA_BASE}/derivatives/thumbs/${slug}-thumbs.jpg`;
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
  
  // Gallery cards
  const galleryImages = [
    { slug: 'img_9761', name: 'Surfing Costa Rica' },
    { slug: 'img_9919', name: 'Rivers' },
    { slug: 'img_5375', name: 'Volcan Poas' },
    { slug: 'img_3491', name: 'Turtles' },
  ];
  
  const galleryCards = GALLERY_SLUGS.map((slug, i) => {
    const img = galleryImages[i] || galleryImages[0];
    const thumbUrl = `${MEDIA_BASE}/derivatives/thumbs/${img.slug}-thumbs.jpg`;
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
