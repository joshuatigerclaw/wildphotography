/**
 * Homepage renderer
 * 
 * Features:
 * - Random photo selection for featured sections
 * - Only shows ready_for_public_render = true photos
 * - Proper derivative selection (thumb -> small -> medium)
 * - Clean display titles, not raw filenames
 */

import { layout, MEDIA_BASE } from './base';
import { getRecentPhotos, getRandomPhotos, getGalleries } from '../lib/db';
import { getHomepageCardImage, getDisplayTitle, renderPlaceholder } from '../lib/images';
import type { Env } from '../types';

export async function renderHome(env: Env, url: URL): Promise<Response> {
  // Get photos - use both recent and random for variety
  const recentPhotos = await getRecentPhotos(6);
  const randomPhotos = await getRandomPhotos(8);
  const galleries = await getGalleries();
  
  // Featured photos section - recent additions
  let featuredContent = '';
  if (recentPhotos.length > 0) {
    const photoCards = recentPhotos.map(photo => {
      const imgResult = getHomepageCardImage(photo);
      
      let imageHtml: string;
      let cardClass = 'photo-card';
      
      if (imgResult.type === 'url') {
        imageHtml = `<img src="${imgResult.url}" alt="${getDisplayTitle(photo)}" loading="lazy">`;
      } else {
        imageHtml = renderPlaceholder('No thumbnail');
        cardClass += ' placeholder';
      }
      
      const displayTitle = getDisplayTitle(photo);
      
      return `
        <a href="/photo/${photo.slug}" class="${cardClass}">
          ${imageHtml}
          <div class="caption">
            <h3>${displayTitle}</h3>
          </div>
        </a>
      `;
    }).join('');
    
    featuredContent = `
      <section class="featured">
        <h2>Recent Photos</h2>
        <div class="gallery">
          ${photoCards}
        </div>
      </section>
    `;
  }
  
  // Discover section - random photos
  let discoverContent = '';
  if (randomPhotos.length > 0) {
    const photoCards = randomPhotos.map(photo => {
      const imgResult = getHomepageCardImage(photo);
      
      let imageHtml: string;
      let cardClass = 'photo-card';
      
      if (imgResult.type === 'url') {
        imageHtml = `<img src="${imgResult.url}" alt="${getDisplayTitle(photo)}" loading="lazy">`;
      } else {
        imageHtml = renderPlaceholder('No thumbnail');
        cardClass += ' placeholder';
      }
      
      const displayTitle = getDisplayTitle(photo);
      
      return `
        <a href="/photo/${photo.slug}" class="${cardClass}">
          ${imageHtml}
          <div class="caption">
            <h3>${displayTitle}</h3>
          </div>
        </a>
      `;
    }).join('');
    
    discoverContent = `
      <section class="discover">
        <h2>Discover</h2>
        <p class="section-desc">Random selections from our collection</p>
        <div class="gallery">
          ${photoCards}
        </div>
      </section>
    `;
  }
  
  // Galleries section
  const galleryCards = galleries.map(g => `
    <a href="/gallery/${g.slug}" class="gallery-card">
      <h3>${g.name}</h3>
      <p>${g.description || 'View gallery'}</p>
    </a>
  `).join('');
  
  const content = `
    <div class="hero">
      <h1>Wildphotography</h1>
      <p>Professional wildlife & nature photography from Costa Rica</p>
    </div>
    
    ${featuredContent}
    
    ${discoverContent}
    
    <section class="galleries">
      <h2>Featured Galleries</h2>
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
