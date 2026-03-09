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
    mainImageHtml = `<img src="${imgResult.url}" alt="${getDisplayTitle(photo)}" style="width:100%;max-width:1200px;height:auto;border-radius:8px;">`;
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
      <p>High-resolution digital download available.</p>
      <button 
        id="buy-button"
        onclick="buyDownload('${photo.slug}', '${displayTitle}')"
        style="background:#0070ba;color:white;padding:12px 24px;border:none;border-radius:4px;font-size:16px;cursor:pointer;"
      >
        Buy Download - $29.00
      </button>
      <div id="checkout-status" style="margin-top:1rem;"></div>
      <script>
        async function buyDownload(slug, title) {
          const btn = document.getElementById('buy-button');
          const status = document.getElementById('checkout-status');
          btn.disabled = true;
          btn.textContent = 'Creating order...';
          
          try {
            const res = await fetch('/api/v1/checkout/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ photoSlug: slug, photoTitle: title, priceCents: 2900 })
            });
            const data = await res.json();
            
            if (data.approveUrl) {
              status.textContent = 'Redirecting to PayPal...';
              window.location.href = data.approveUrl;
            } else {
              status.textContent = 'Error: ' + (data.error || 'Unknown error');
              btn.disabled = false;
              btn.textContent = 'Buy Download - $29.00';
            }
          } catch (e) {
            status.textContent = 'Error: ' + e.message;
            btn.disabled = false;
            btn.textContent = 'Buy Download - $29.00';
          }
        }
      </script>
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
