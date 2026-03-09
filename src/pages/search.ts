/**
 * Search page renderer
 * 
 * Uses strict derivative selection:
 * - Gets derivative keys from Neon DB
 * - Uses getSearchCardImage() for result cards
 * - Shows readable titles, not raw filenames
 */

import { layout } from './base';
import { searchPhotos } from '../lib/db';
import { getSearchCardImage, getDisplayTitle, renderPlaceholder } from '../lib/images';
import type { Env } from '../types';

export async function renderSearch(env: Env, url: URL): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  
  let resultsContent: string;
  
  if (!query) {
    resultsContent = `
      <p>Enter a search term above to find photos.</p>
    `;
  } else {
    // Search with derivative keys from DB
    const results = await searchPhotos(query, 20);
    
    if (results.length > 0) {
      const resultCards = results.map(photo => {
        // Use strict derivative selection for search results
        const imgResult = getSearchCardImage(photo);
        
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
      
      resultsContent = `
        <p>Found ${results.length} photo${results.length !== 1 ? 's' : ''} for "${query}"</p>
        <div class="gallery">
          ${resultCards}
        </div>
      `;
    } else {
      resultsContent = `
        <p>No photos found for "${query}".</p>
        <p>Try different keywords like "bird", "surf", "beach", or "nature".</p>
      `;
    }
  }
  
  const content = `
    <h1>Search Photos</h1>
    
    <form action="/search" method="get" style="margin: 1rem 0">
      <input 
        type="text" 
        name="q" 
        value="${query}" 
        placeholder="Search photos..."
        style="padding: 0.5rem; width: 100%; max-width: 400px; font-size: 1rem;"
      >
      <button type="submit" style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
        Search
      </button>
    </form>
    
    ${resultsContent}
  `;
  
  return layout(`Search${query ? ' - ' + query : ''} - Wildphotography`, content);
}
