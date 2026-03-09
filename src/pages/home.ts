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

export async function renderHome(env: Env, url: URL): Promise<Response> {
  // Try to get galleries from Neon
  let galleries: any[] = [];
  let photos: any[] = [];
  
  try {
    // Try to get photos from the API
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
  
  // Use real galleries if available, otherwise use known gallery names
  if (galleries.length === 0) {
    galleries = GALLERY_SLUGS.map(slug => ({
      slug,
      name: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }));
  }
  
  // Use photos if available, otherwise use known derivative images
  if (photos.length === 0) {
    photos = [
      { title: 'IMG_9761', slug: 'img-9761', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_9761-thumbs.jpg` },
      { title: 'IMG_9867', slug: 'img-9867', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_9867-thumbs.jpg` },
      { title: 'IMG_0133', slug: 'img-0133', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_0133-thumbs.jpg` },
      { title: 'IMG_0135', slug: 'img-0135', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_0135-thumbs.jpg` },
      { title: 'IMG_0143', slug: 'img-0143', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_0143-thumbs.jpg` },
      { title: 'IMG_0154', slug: 'img-0154', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_0154-thumbs.jpg` },
      { title: 'IMG_3491', slug: 'img-3491', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_3491-thumbs.jpg` },
      { title: 'IMG_3501', slug: 'img-3501', thumbUrl: `${MEDIA_BASE}/derivatives/thumbs/img_3501-thumbs.jpg` },
    ];
  }
  
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
  
  const galleryCards = galleries.map(g => `
    <div class="photo-card">
      <a href="/gallery/${g.slug}">
        <img src="${MEDIA_BASE}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg" alt="${g.name}">
        <div class="caption">
          <h3>${g.name}</h3>
        </div>
      </a>
    </div>`).join('');
  
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
