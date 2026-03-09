/**
 * Gallery page renderer
 * 
 * Uses strict derivative selection:
 * - Gets derivative keys from Neon DB
 * - Uses getGalleryTileImage() for consistent selection
 * - Shows readable titles, not raw filenames
 */

import { layout } from './base';
import { getGalleryBySlug, getPhotosByGallery } from '../lib/db';
import { getGalleryTileImage, getDisplayTitle, renderPlaceholder } from '../lib/images';
import type { Env } from '../types';

export async function renderGallery(slug: string, env: Env, url: URL): Promise<Response> {
  const gallery = await getGalleryBySlug(slug);
  const photos = await getPhotosByGallery(slug);
  
  const galleryName = gallery?.name || slug;
  const galleryDescription = gallery?.description || '';
  
  // Gallery tiles using strict derivative selection
  let photoContent: string;
  
  if (photos.length > 0) {
    const photoCards = photos.map(photo => {
      // Use strict derivative selection for gallery tiles
      const imgResult = getGalleryTileImage(photo);
      
      let imageHtml: string;
      let cardClass = 'photo-card';
      
      if (imgResult.type === 'url') {
        imageHtml = `<img src="${imgResult.url}" alt="${getDisplayTitle(photo)}" loading="lazy">`;
      } else {
        imageHtml = renderPlaceholder('No thumbnail');
        cardClass += ' placeholder';
      }
      
      // Use clean display title
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
    
    photoContent = `
      <div class="gallery">
        ${photoCards}
      </div>
    `;
  } else {
    photoContent = `
      <p>No photos in this gallery yet.</p>
    `;
  }
  
  const content = `
    <a href="/" class="back-link">← Back to Galleries</a>
    
    <h2 style="margin:1rem 0">${galleryName}</h2>
    ${galleryDescription ? `<p>${galleryDescription}</p>` : ''}
    
    ${photoContent}
  `;
  
  return layout(`${galleryName} - Wildphotography`, content);
}
