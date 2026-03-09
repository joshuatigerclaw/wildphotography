/**
 * Gallery page renderer
 * 
 * Premium masonry grid layout with:
 * - Responsive columns (2/3/4/6)
 * - Lazy loading
 * - Hover overlay with title/keywords
 * - Infinite scroll ready
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
  
  // Premium masonry grid
  let photoContent: string;
  
  if (photos.length > 0) {
    // Generate photo cards with data attributes for masonry
    const photoCards = photos.map((photo, index) => {
      const imgResult = getGalleryTileImage(photo);
      const displayTitle = getDisplayTitle(photo);
      
      let imageHtml: string;
      let cardClass = 'masonry-item';
      
      if (imgResult.type === 'url') {
        imageHtml = `
          <img 
            src="${imgResult.url}" 
            alt="${displayTitle}" 
            loading="lazy"
            decoding="async"
            class="masonry-img"
          >
          <div class="masonry-overlay">
            <span class="masonry-title">${displayTitle}</span>
            <span class="masonry-view">View →</span>
          </div>
        `;
      } else {
        imageHtml = renderPlaceholder('No thumbnail');
      }
      
      // Add aspect ratio hint based on index for visual variety
      const aspectClass = index % 3 === 0 ? 'tall' : index % 2 === 0 ? 'wide' : 'square';
      
      return `
        <a href="/photo/${photo.slug}" class="${cardClass} ${aspectClass}" data-index="${index}">
          ${imageHtml}
        </a>
      `;
    }).join('');
    
    photoContent = `
      <div class="masonry-grid" id="gallery-grid">
        ${photoCards}
      </div>
      <div class="masonry-footer">
        <p>Showing ${photos.length} photos</p>
      </div>
    `;
  } else {
    photoContent = `
      <div class="empty-gallery">
        <p>No photos in this gallery yet.</p>
      </div>
    `;
  }
  
  const content = `
    <a href="/" class="back-link">← Back to Galleries</a>
    
    <header class="gallery-header">
      <h1>${galleryName}</h1>
      ${galleryDescription ? `<p class="gallery-desc">${galleryDescription}</p>` : ''}
    </header>
    
    ${photoContent}
    
    <style>
      /* Premium Masonry Grid */
      .gallery-header {
        text-align: center;
        padding: 2rem 1rem;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        color: white;
        margin-bottom: 2rem;
      }
      
      .gallery-header h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
        font-weight: 300;
      }
      
      .gallery-desc {
        color: #aaa;
        max-width: 600px;
        margin: 0 auto;
      }
      
      .masonry-grid {
        column-count: 2;
        column-gap: 1rem;
        padding: 0 1rem;
        max-width: 1800px;
        margin: 0 auto;
      }
      
      @media (min-width: 640px) {
        .masonry-grid { column-count: 3; }
      }
      
      @media (min-width: 1024px) {
        .masonry-grid { column-count: 4; }
      }
      
      @media (min-width: 1400px) {
        .masonry-grid { column-count: 5; }
      }
      
      @media (min-width: 1800px) {
        .masonry-grid { column-count: 6; }
      }
      
      .masonry-item {
        break-inside: avoid;
        margin-bottom: 1rem;
        display: block;
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        background: #f0f0f0;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      
      .masonry-item:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0,0,0,0.2);
      }
      
      .masonry-item.tall { grid-row: span 2; }
      .masonry-item.wide { grid-column: span 2; }
      
      .masonry-img {
        width: 100%;
        height: auto;
        display: block;
        transition: transform 0.4s ease;
      }
      
      .masonry-item:hover .masonry-img {
        transform: scale(1.05);
      }
      
      .masonry-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 2rem 1rem 1rem;
        background: linear-gradient(transparent, rgba(0,0,0,0.85));
        color: white;
        opacity: 0;
        transition: opacity 0.3s ease;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      
      .masonry-item:hover .masonry-overlay {
        opacity: 1;
      }
      
      .masonry-title {
        font-weight: 500;
        font-size: 0.95rem;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        max-width: 70%;
      }
      
      .masonry-view {
        font-size: 0.85rem;
        color: #4CAF50;
        font-weight: 500;
      }
      
      .masonry-footer {
        text-align: center;
        padding: 2rem;
        color: #666;
      }
      
      .empty-gallery {
        text-align: center;
        padding: 4rem 2rem;
        color: #666;
      }
      
      .back-link {
        display: inline-block;
        padding: 1rem 2rem;
        color: #333;
        font-weight: 500;
      }
      
      .back-link:hover {
        color: #000;
      }
    </style>
  `;
  
  return layout(`${galleryName} - Wildphotography`, content);
}
