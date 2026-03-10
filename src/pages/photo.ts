/**
 * Photo detail page renderer
 * 
 * Features:
 * - Large main image display
 * - Prominent title and description
 * - Keyword chips (clickable to search)
 * - Location map (conditional on GPS)
 * - Visit tracking
 * - Download purchase button
 */

import { layout } from './base';
import { getPhotoBySlug, recordPhotoVisit } from '../lib/db';
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
  
  // Record visit - wrap in try/catch to prevent errors
  try {
    const referrer = url?.searchParams?.get ? url.searchParams.get('ref') || undefined : undefined;
    const userAgent = url?.headers?.get ? url.headers.get('user-agent') || undefined : undefined;
    recordPhotoVisit(photo.id, photo.slug, referrer, userAgent).catch(() => {});
  } catch (e) {
    // Ignore visit recording errors
  }
  
  // Main image using strict derivative selection
  const imgResult = getPhotoPageMainImage(photo);
  
  let mainImageHtml: string;
  if (imgResult.type === 'url') {
    mainImageHtml = `<img src="${imgResult.url}" alt="${getDisplayTitle(photo)}" class="main-photo">`;
  } else {
    mainImageHtml = renderPlaceholder('No image available');
  }
  
  // Use clean display title
  const displayTitle = getDisplayTitle(photo);
  
  // Description
  const descriptionHtml = photo.description_long || photo.description || '';
  
  // Keywords as clickable chips
  let keywordsHtml = '';
  if (photo.keywords) {
    const keywords = photo.keywords.split(',').map(k => k.trim()).filter(Boolean);
    if (keywords.length > 0) {
      keywordsHtml = `
        <div class="keywords">
          <span class="keywords-label">Keywords:</span>
          ${keywords.map(k => `<a href="/search?q=${encodeURIComponent(k)}" class="keyword-chip">${k}</a>`).join('')}
        </div>
      `;
    }
  }
  
  // Location map (conditional on GPS)
  let mapHtml = '';
  if (photo.lat && photo.lon && photo.lat !== 0 && photo.lon !== 0) {
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${photo.lon-0.01}%2C${photo.lat-0.01}%2C${photo.lon+0.01}%2C${photo.lat+0.01}&layer=mapnik&marker=${photo.lat}%2C${photo.lon}`;
    mapHtml = `
      <div class="location-section">
        <h3>Location</h3>
        <div class="map-container">
          <iframe width="100%" height="300" frameborder="0" scrolling="no" src="${embedUrl}" style="border:none"></iframe>
        </div>
        <p class="location-name">${photo.locationName || 'Costa Rica'}</p>
      </div>
    `;
  }
  
  // Metadata section
  const metadataItems = [];
  if (photo.width && photo.height) {
    metadataItems.push(`<li><strong>Dimensions:</strong> ${photo.width} × ${photo.height}</li>`);
  }
  if (photo.camera_model) {
    metadataItems.push(`<li><strong>Camera:</strong> ${photo.camera_model}</li>`);
  }
  if (photo.locationName) {
    metadataItems.push(`<li><strong>Location:</strong> ${photo.locationName}</li>`);
  }
  if (photo.views_count) {
    metadataItems.push(`<li><strong>Views:</strong> ${photo.views_count}</li>`);
  }
  
  const metadataHtml = metadataItems.length > 0 ? `
    <div class="metadata">
      <ul>
        ${metadataItems.join('')}
      </ul>
    </div>
  ` : '';
  
  // Download button
  const downloadSection = `
    <div class="downloads">
      <button id="buy-button" class="buy-button">Buy High-Res Download — $29.00</button>
      <div id="checkout-status"></div>
    </div>
  `;
  
  const content = `
    <a href="/" class="back-link">← Back to Galleries</a>
    
    <article class="photo-detail">
      <header class="photo-header">
        <h1>${displayTitle}</h1>
        ${descriptionHtml ? `<p class="photo-description">${descriptionHtml}</p>` : ''}
      </header>
      
      <div class="photo-image">
        ${mainImageHtml}
      </div>
      
      ${keywordsHtml}
      
      ${metadataHtml}
      
      ${mapHtml}
      
      ${downloadSection}
    </article>
  `;
  
  return layout(`${displayTitle} - Wildphotography`, content);
}
