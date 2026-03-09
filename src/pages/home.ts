/**
 * Homepage renderer
 * 
 * Uses strict derivative selection:
 * - Gets derivative keys from Neon DB
 * - Uses getHomepageCardImage() for consistent selection
 * - Shows readable titles, not raw filenames
 */

import { layout, MEDIA_BASE } from './base';
import { getRecentPhotos, getGalleries } from '../lib/db';
import { getHomepageCardImage, getDisplayTitle, renderPlaceholder } from '../lib/images';
import type { Env } from '../types';

export async function renderHome(env: Env, url: URL): Promise<Response> {
  // Fetch photos with derivative keys from DB
  const photos = await getRecentPhotos(6);
  const galleries = await getGalleries();
  
  // Featured photos section using strict derivative selection
  let featuredContent = '';
  
  if (photos.length > 0) {
    const photoCards = photos.map(photo => {
      // Use strict derivative selection
      const imgResult = getHomepageCardImage(photo);
      
      let imageHtml: string;
      let cardClass = 'photo-card';
      
      if (imgResult.type === 'url') {
        imageHtml = `<img src="${imgResult.url}" alt="${getDisplayTitle(photo)}" loading="lazy">`;
      } else {
        imageHtml = renderPlaceholder('No thumbnail');
        cardClass += ' placeholder';
      }
      
      // Use clean display title, not raw filename
      const displayTitle = getDisplayTitle(photo);
      
      return `
        <div class="${cardClass}">
          ${imageHtml}
          <div class="caption">
            <h3>${displayTitle}</h3>
          </div>
        </div>
      `;
    }).join('');
    
    featuredContent = `
      <section class="featured">
        <h2>Featured Photos</h2>
        <div class="gallery">
          ${photoCards}
        </div>
      </section>
    `;
  } else {
    featuredContent = `
      <section class="featured">
        <p>No photos available yet.</p>
      </section>
    `;
  }
  
  // Galleries section
  const galleryCards = galleries.map(g => `
    <div class="gallery-card">
      <h3>${g.name}</h3>
      <p>${g.description || 'View gallery'}</p>
    </div>
  `).join('');
  
  const content = `
    <div class="hero">
      <h1>Wildphotography</h1>
      <p>Professional wildlife & nature photography from Costa Rica</p>
    </div>
    
    ${featuredContent}
    
    <section class="galleries">
      <h2>Galleries</h2>
      <div class="gallery">
        ${galleryCards}
      </div>
    </section>
    
    <section class="about">
      <h2>About</h2>
      <p>Joshua ten Brink is a professional wildlife photographer based in Costa Rica. 
         With over 50,000 proprietary images, he captures the incredible biodiversity 
         of this beautiful country.</p>
    </section>
  `;
  
  return layout('Wildphotography - Professional Costa Rica Wildlife Photography', content);
}
