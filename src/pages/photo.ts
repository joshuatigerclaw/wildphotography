/**
 * Photo detail page renderer
 * 
 * Uses strict derivative selection:
 * - Gets derivative keys from Neon DB
 * - Uses getPhotoPageMainImage() for main display
 * - Shows readable title, not raw filename
 */

import { layout } from './base';
import { getPhotoBySlug } from '../lib/db';
import { getPhotoPageMainImage, getDisplayTitle, renderPlaceholder, keyToUrl } from '../lib/images';
import type { Env } from '../types';

export async function renderPhoto(slug: string, env: Env, url: URL): Promise<Response> {
  const photo = await getPhotoBySlug(slug);
  
  if (!photo) {
    const content = `
      <div style="text-align:center;padding:4rem 0">
        <h2>Photo Not Found</h2>
        <p>The requested photo could not be found.</p>
        <a href="/">Return to homepage</a>
      </div>
    `;
    return layout('Not Found - Wildphotography', content);
  }
  
  // Main image using strict derivative selection (large → preview → medium → small → thumb)
  const imgResult = getPhotoPageMainImage(photo);
  
  let mainImageHtml: string;
  if (imgResult.type === 'url') {
    mainImageHtml = `<img src="${imgResult.url}" alt="${getDisplayTitle(photo)}" style="max-width:100%;border-radius:8px;">`;
  } else {
    mainImageHtml = renderPlaceholder('No image available');
  }
  
  // Use clean display title
  const displayTitle = getDisplayTitle(photo);
  
  // Build download links (if user is authenticated - for now, show placeholder)
  // Note: Downloads must remain private (403 for unauthorized)
  const downloadSection = `
    <div class="downloads">
      <h3>Downloads</h3>
      <p>Contact us for high-resolution versions.</p>
    </div>
  `;
  
  // Metadata
  const metadata = [];
  if (photo.locationName) {
    metadata.push(`<li><strong>Location:</strong> ${photo.locationName}</li>`);
  }
  if (photo.description) {
    metadata.push(`<li><strong>Description:</strong> ${photo.description}</li>`);
  }
  
  const content = `
    <a href="/gallery/surfing-costa-rica" class="back-link">← Back to Gallery</a>
    
    <div class="photo">
      <h2>${displayTitle}</h2>
      
      ${mainImageHtml}
      
      ${metadata.length > 0 ? `
        <ul style="list-style:none;padding:0;margin:1rem 0">
          ${metadata.join('')}
        </ul>
      ` : ''}
      
      ${downloadSection}
    </div>
  `;
  
  return layout(`${displayTitle} - Wildphotography`, content);
}
