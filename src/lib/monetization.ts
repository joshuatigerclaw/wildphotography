/**
 * Monetization helpers for WildPhotography
 */

// GetYourGuide Partner ID
export const GYG_PARTNER_ID = '6ZV7KMH';
export const GYG_CMP = 'wildphoto';

/**
 * Render GetYourGuide auto widget
 * @param location - Location/destination for tours
 * @param category - Optional category filter
 */
export function renderGYGWidget(location: string, category?: string): string {
  const locationSlug = location.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  return `
    <div class="gyg-widget-container">
      <h3>Best Tours in ${location}</h3>
      <div 
        data-gyg-widget="auto" 
        data-gyg-partner-id="${GYG_PARTNER_ID}" 
        data-gyg-cmp="${GYG_CMP}"
        data-gyg-location="${locationSlug}"
        ${category ? `data-gyg-category="${category}"` : ''}
        data-gyg-lang="en"
      ></div>
    </div>
  `;
}

/**
 * Render a simple tour CTA that links to GetYourGuide
 */
export function renderTourCTA(location: string): string {
  const locationSlug = location.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const gygUrl = `https://www.getyourguide.com/?partner_id=${GYG_PARTNER_ID}&q=${locationSlug}`;
  
  return `
    <div class="tour-cta">
      <a href="${gygUrl}" target="_blank" rel="nofollow" class="tour-cta-btn">
        Find Tours in ${location} ->
      </a>
    </div>
  `;
}
