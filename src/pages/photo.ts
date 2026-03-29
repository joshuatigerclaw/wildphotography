/**
 * Photo detail page renderer
 * 
 * Features:
 * - Large main image display
 * - Prominent title and description
 * - Keyword chips (clickable to search)
 * - Location map (conditional on GPS data)
 * - Visit tracking
 * - Download purchase button
 */

import { layout } from './base';
import { getPhotoBySlug, recordPhotoVisit } from '../lib/db';
import { getPhotoPageMainImage, getDisplayTitle, renderPlaceholder, keyToUrl } from '../lib/images';
import { renderGYGWidget, GYG_PARTNER_ID } from '../lib/monetization';
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
  
  // Record visit
  const referrer = undefined; // url.searchParams ? url.searchParams.get('ref') || undefined;
  const userAgent = undefined; // url.headers ? url.headers.get('user-agent') || undefined;
  recordPhotoVisit(photo.id, photo.slug, referrer, userAgent).catch(console.error);
  
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
  
  // ── E: Description ───────────────────────────────────────────────────────────
  const descriptionHtml = photo.description_long || photo.description || '';

  // ── F: Location + Key Metadata ─────────────────────────────────────────────
  // Build polished location hierarchy: LocationName, Region, Country
  const locationParts = [
    photo.locationName,
    photo.region,
    photo.country || 'Costa Rica',
  ].filter(Boolean);

  const locationHierarchyHtml = locationParts.length > 0
    ? `<p class="photo-location-hierarchy">${locationParts.join(', ')}</p>`
    : '';

  // Key compact metadata (not location — that's above)
  const compactMetaItems: string[] = [];
  if (photo.width && photo.height) {
    compactMetaItems.push(`<span class="meta-item"><strong>Dimensions:</strong> ${photo.width} × ${photo.height}</span>`);
  }
  if (photo.camera_model) {
    compactMetaItems.push(`<span class="meta-item"><strong>Camera:</strong> ${photo.camera_model}</span>`);
  }
  if (photo.views_count) {
    compactMetaItems.push(`<span class="meta-item"><strong>Views:</strong> ${photo.views_count.toLocaleString()}</span>`);
  }
  const compactMetadataHtml = compactMetaItems.length > 0
    ? `<div class="compact-meta">${compactMetaItems.join(' · ')}</div>`
    : '';

  // ── G: Keywords ─────────────────────────────────────────────────────────────
  let keywordsHtml = '';
  if (photo.keywords) {
    const raw = photo.keywords.trim();
    const keywords = raw.includes(',')
      ? raw.split(',').map((k) => k.trim()).filter(Boolean)
      : raw.split(/\s+/).map((k) => k.trim()).filter(Boolean);
    if (keywords.length > 0) {
      keywordsHtml = `
        <div class="keywords">
          ${keywords.map(k => `<a href="/search?q=${encodeURIComponent(k)}" class="keyword-chip">${k}</a>`).join(' ')}
        </div>
      `;
    }
  }

  // ── H: Map ──────────────────────────────────────────────────────────────────
  let mapHtml = '';
  if (photo.lat && photo.lon && photo.lat !== 0 && photo.lon !== 0) {
    mapHtml = `
      <div class="location-section">
        <div class="map-container">
          <img src="https://maps.googleapis.com/maps/api/staticmap?center=${photo.lat},${photo.lon}&zoom=10&size=600x300&markers=${photo.lat},${photo.lon}&key=AIzaSyDlPfxC2naf0Ifc_tH4HTLQoKJZ60fi0fo"
               alt="Photo location map"
               class="location-map"
               onerror="this.parentElement.style.display='none'">
        </div>
      </div>
    `;
  }

  // ── D: Affiliate block (above description, between image and description) ───
  const locationLabel = photo.locationName || photo.region || 'Costa Rica';
  const gygAffiliateHtml = renderGYGWidget(locationLabel);
  
  // Download button
  const downloadSection = `
    <div class="downloads">
      <button 
        id="buy-button"
        onclick="buyDownload('${photo.slug}', '${displayTitle.replace(/'/g, "\\'")}')"
        class="buy-button"
      >
        Buy High-Res Download — $29.00
      </button>
      <div id="checkout-status"></div>
      <script>
        async function buyDownload(slug, title) {
          const btn = document.getElementById('buy-button');
          const status = document.getElementById('checkout-status');
          btn.disabled = true;
          btn.textContent = 'Creating order...';
          
          
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
              btn.textContent = 'Buy High-Res Download — $29.00';
            }
          } catch (e) {
            status.textContent = 'Error: ' + e.message;
            btn.disabled = false;
            btn.textContent = 'Buy High-Res Download — $29.00';
          }
        }
      </script>
    </div>
  `;
  
  // ── J: Discovery modules ──────────────────────────────────────────────────
  let discoveryHtml = '';
  const photoId = photo.id;
  const galleryId = photo.gallery_id;
  const gallerySlug = photo.gallery_slug || '';

  if (galleryId) {
    discoveryHtml += `
      <section class="discovery-section">
        <h2 class="discovery-heading">More from this gallery</h2>
        <div class="related-photos-grid" id="gallery-related-photos"></div>
      </section>
    `;
  }

  if (photo.animal_group || photo.species_common_name) {
    discoveryHtml += `
      <section class="discovery-section">
        <h2 class="discovery-heading">Related species</h2>
        <div class="related-species-grid" id="related-species-grid"></div>
      </section>
    `;
  }

  if (photo.locationName) {
    discoveryHtml += `
      <section class="discovery-section">
        <h2 class="discovery-heading">More from ${photo.locationName}</h2>
        <div class="related-location-grid" id="related-location-grid"></div>
      </section>
    `;
  }

  const content = `
    <a href="/" class="back-link">← Back to Galleries</a>
    
    <article class="photo-detail">
      <header class="photo-header">
        <h1>${displayTitle}</h1>
      </header>
      
      <div class="photo-image">
        ${mainImageHtml}
      </div>
      
      ${gygAffiliateHtml}
      
      ${descriptionHtml ? `<div class="photo-description-block"><p class="photo-description">${descriptionHtml}</p></div>` : ''}
      
      ${locationHierarchyHtml}
      ${compactMetadataHtml}
      
      ${keywordsHtml}
      
      ${mapHtml}
      
      ${downloadSection}
      
      ${discoveryHtml}
    </article>
  `;
  
  // SEO optimization: derive full SEO fields from photo metadata
  const canonical = `https://wildphotography.com/photo/${photo.slug}`;
  const description = photo.description_long || photo.description || `${displayTitle} - professional wildlife photography from Costa Rica by Joshua ten Brink`;
  const ogImage = photo.thumb_url || '';
  const hasThinContent = !photo.description_long && !photo.description;
  const noindex = hasThinContent;

  // JSON-LD: ImageObject schema for photo detail pages
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "name": displayTitle,
    "description": description,
    "url": ogImage,
    "contentUrl": ogImage,
    "author": {
      "@type": "Person",
      "name": "Joshua ten Brink"
    },
    "creator": {
      "@type": "Person",
      "name": "Joshua ten Brink"
    },
    "locationCreated": photo.locationName ? {
      "@type": "Place",
      "name": photo.locationName,
      "addressRegion": photo.region || undefined,
      "addressCountry": photo.country || "CR"
    } : undefined,
    "keywords": photo.keywords || undefined,
    "datePublished": photo.date_taken ? new Date(photo.date_taken).toISOString().split('T')[0] : undefined,
    "width": photo.width ? `${photo.width}px` : undefined,
    "height": photo.height ? `${photo.height}px` : undefined,
    "genre": photo.animal_group || "Wildlife Photography"
  });

  return layout(`${displayTitle} — Wildphotography`, content, '', '', {
    canonical,
    description,
    ogImage,
    ogType: 'article',
    noindex,
    jsonLd
  });
}
