/**
 * Search page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import { searchPhotos } from '../lib/search';
import type { Env } from '../types';

export async function renderSearch(env: Env, url: URL): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  
  let resultsHtml = '';
  
  if (query) {
    const photos = await searchPhotos(query);
    
    if (photos.length > 0) {
      resultsHtml = `
        <p>Found ${photos.length} results for "${query}"</p>
        <div class="gallery">
          ${photos.map(p => `
            <div class="photo-card">
              <a href="/photo/${p.slug}">
                <img src="${MEDIA_BASE}/derivatives/thumbs/${(p.filename || p.slug + '.jpg').replace('.jpg', '-thumb.jpg')}" alt="${p.title}" loading="lazy">
                <div class="caption">
                  <h3>${p.title}</h3>
                  ${p.locationName ? `<p>📍 ${p.locationName}</p>` : ''}
                </div>
              </a>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      resultsHtml = `<p>No results found for "${query}". Try different keywords.</p>`;
    }
  }
  
  const content = `
    <h2>Search Photos</h2>
    <form action="/search" method="get">
      <input type="text" name="q" placeholder="Search photos..." value="${query}" autofocus>
      <button type="submit">Search</button>
    </form>
    ${resultsHtml}
    <p style="text-align:center;color:#666;margin-top:2rem">
      Try: bird, macaw, landscape, surf, turtle, costa rica
    </p>
  `;
  
  return renderPage('Search | Wildphotography', content);
}
