/**
 * Gallery page renderer with monetization blocks
 * 
 * Features:
 * - Premium masonry grid layout
 * - Infinite scroll + Load more
 * - Affiliate monetization blocks (GetYourGuide, Viator, Amazon, Expedia)
 * - SEO optimized
 */

import { layout } from './base';
import { getGalleryBySlug, getPhotosByGallery, getGalleryPhotoCount, getGalleryById, getRelatedGalleries, getSpeciesForGallery } from '../lib/db';
import { getGalleryTileImage, getDisplayTitle, renderPlaceholder } from '../lib/images';
import { renderGYGWidget, GYG_PARTNER_ID } from '../lib/monetization';
import type { Env } from '../types';

// Destination hub mapping for affiliate matching
const DESTINATION_HUBS: Record<string, any> = {
  'monteverde': { name: 'Monteverde', aliases: ['monteverde', 'cloud forest', 'santa elena'], tours: ['night walk', 'birdwatching', 'cloud forest'], products: ['binoculars', 'rain jacket'], hotels: ['eco lodge', 'cloud forest'] },
  'tortuguero': { name: 'Tortuguero', aliases: ['tortuguero', 'tortuguero national park'], tours: ['canal tour', 'wildlife', 'boat'], products: ['dry bag', 'binoculars'], hotels: ['jungle lodge'] },
  'corcovado': { name: 'Corcovado', aliases: ['corcovado', 'osa', 'drake bay', 'puerto jimenez', 'peninsula de osa', 'peninsula-de-osa'], tours: ['corcovado', 'wildlife', 'hiking'], products: ['hiking boots', 'dry bag'], hotels: ['eco lodge', 'jungle'] },
  'arenal': { name: 'Arenal', aliases: ['arenal', 'la fortuna'], tours: ['hanging bridges', 'hot springs', 'nature'], products: ['rain protection', 'binoculars'], hotels: ['volcano view', 'resort'] },
  'carara': { name: 'Carara', aliases: ['carara', 'tarcoles', 'jaco', 'birds macaws lapas', 'birds-macaws-lapas'], tours: ['birdwatching', 'scarlet macaw', 'crocodile'], products: ['binoculars', 'telephoto'], hotels: ['nature lodge', 'beach hotel'] },
  'manuel-antonio': { name: 'Manuel Antonio', aliases: ['manuel antonio', 'quepos'], tours: ['national park', 'sloth', 'catamaran'], products: ['daypack', 'binoculars'], hotels: ['beach', 'resort'] },
  'uvita': { name: 'Uvita & Dominical', aliases: ['uvita', 'dominical', 'dominical and uvita', 'dominical-and-uvita', 'marino ballena', 'ballena'], tours: ['whale watching', 'boat tour', 'snorkeling'], products: ['dry bag', 'binoculars'], hotels: ['beach hotel', 'eco lodge'] },
  'nicoya_peninsula': { name: 'Nicoya Peninsula', aliases: ['tambor', 'nicoya peninsula', 'nicoya', 'tambor-nicoya-peninsula-costa-rica', 'peninsula de nicoya', 'peninsula-de-nicoya'], tours: ['boat tour', 'beach day', 'snorkeling'], products: ['sunscreen', 'snorkel gear'], hotels: ['beach resort', 'boutique hotel'] },
  'guanacaste': { name: 'Guanacaste', aliases: ['guanacaste'], tours: ['snorkeling', 'sunset cruise', 'atv'], products: ['sunscreen', 'sunglasses'], hotels: ['all-inclusive resort', 'beach hotel'] },
  'guanacaste_beaches': { name: 'Guanacaste Beaches', aliases: ['playas del coco', 'playas-del-coco', 'papagayo', 'bahia culebra', 'papagayo-bahia-culebra', 'playa hermosa guanacaste', 'playa-hermosa-guanacaste', 'tamarindo', 'tamarindo-guanacaste-costa-rica', 'flamingo beach', 'flamingo-beach', 'las catalinas', 'las-catalinas-guanacaste', 'punta cacique', 'punta-cacique-guancaste', 'samara', 'samara-playa-carillo', 'beaches'], tours: ['snorkeling', 'sunset cruise', 'fishing'], products: ['sunscreen', 'snorkel gear', 'sunglasses'], hotels: ['beach resort', 'vacation rental'] },
  'pacifica_beaches': { name: 'Pacific Coast Beaches', aliases: ['montezuma', 'montezuma-costa-rica', 'santa teresa', 'santa-teresa-malpais', 'malpais', 'isla tortuga', 'isla-tortuga', 'cabo matapalo'], tours: ['surf lesson', 'boat tour', 'waterfall hike'], products: ['surfboard wax', 'reef-safe sunscreen', 'dry bag'], hotels: ['surf camp', 'beach bungalow'] },
  'central_pacific': { name: 'Central Pacific Coast', aliases: ['puntarenas', 'puntarenas-costa-rica', 'punta leona', 'punta-leona', 'puerto caldera'], tours: ['city tour', 'boat tour'], products: ['daypack', 'sun protection'], hotels: ['port hotel', 'beach hotel'] },
  'surfing': { name: 'Costa Rica Surf', aliases: ['surfing costa rica', 'surfing-costa-rica', 'surfing'], tours: ['surf lesson', 'surf camp'], products: ['surfboard', 'reef-safe sunscreen', 'rash guard'], hotels: ['surf camp', 'beach hostel'] },
  'waterfalls': { name: 'Costa Rica Waterfalls', aliases: ['waterfalls in costa rica', 'waterfalls-in-costa-rica', 'nauyaca', 'nauyaca-waterfalls', 'waterfall'], tours: ['waterfall hike', 'canyoning'], products: ['water shoes', 'dry bag', 'go pro'], hotels: ['river lodge', 'eco lodge'] },
  'turtles': { name: 'Turtle Nesting Sites', aliases: ['turtles'], tours: ['turtle nesting tour', 'night tour'], products: ['red flashlight', 'binoculars'], hotels: ['jungle lodge', 'eco resort'] },
  'rincon': { name: 'Rincon de la Vieja', aliases: ['rincon de la vieja', 'rincon-de-la-vieja', 'rincon'], tours: ['volcano hike', 'hot springs', 'horseback riding'], products: ['hiking boots', 'mud boots'], hotels: ['hot springs resort', 'eco lodge'] },
  'poas_irazu': { name: 'Costa Rica Volcanoes', aliases: ['poas', 'volcan poas', 'poas-volcano-costa-rica', 'irazu', 'volcan irazu', 'volcan-irazu'], tours: ['volcano day trip', 'cloud forest walk'], products: ['rain jacket', 'hiking boots'], hotels: ['mountain lodge', 'cloud forest hotel'] },
  'limon': { name: 'Caribbean Coast', aliases: ['limon', 'puerto viejo', 'limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva', 'cahuita'], tours: ['jungle tour', 'sloth watching'], products: ['binoculars', 'bug spray'], hotels: ['caribbean hotel', 'eco lodge'] }
};

const INITIAL_LOAD = 20;

export async function renderGallery(slug: string, env: Env, url: URL): Promise<Response> {
  const gallery = await getGalleryBySlug(slug);
  const photos = await getPhotosByGallery(slug, INITIAL_LOAD, 0);
  const totalCount = await getGalleryPhotoCount(slug);

  // Internal linking: parent gallery, related galleries, species in gallery
  let parentGalleryHtml = '';
  let relatedGalleriesHtml = '';
  let speciesLinksHtml = '';

  if (gallery) {
    // Parent gallery link
    if (gallery.parent_gallery_id) {
      const parentGallery = await getGalleryById(gallery.parent_gallery_id);
      if (parentGallery) {
        parentGalleryHtml = `<a href="/gallery/${parentGallery.slug}" class="gallery-breadcrumb-link">&larr; ${parentGallery.name}</a>`;
      }
    }

    // Related galleries (siblings under same parent)
    const relatedGalleries = await getRelatedGalleries(gallery.id, gallery.parent_gallery_id ?? null, null, 5);
    if (relatedGalleries.length > 0) {
      relatedGalleriesHtml = `
        <div class="internal-links-section">
          <h3>More Galleries</h3>
          <div class="related-gallery-links">
            ${relatedGalleries.map((rg: any) => `
              <a href="/gallery/${rg.slug}" class="related-gallery-chip">${rg.name}</a>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Species found in this gallery's photos
    const speciesNames = await getSpeciesForGallery(slug, 5);
    if (speciesNames.length > 0) {
      speciesLinksHtml = `
        <div class="internal-links-section">
          <h3>Birds in This Gallery</h3>
          <div class="species-gallery-links">
            ${speciesNames.map((sp: string) => {
              const spSlug = sp.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
              return `<a href="/species/${spSlug}" class="species-gallery-chip">${sp}</a>`;
            }).join('')}
          </div>
        </div>
      `;
    }
  }

  const galleryName = gallery?.name || slug;
  const galleryDescription = gallery?.description || '';
  const hasMore = photos.length < totalCount;
  
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
            width="${photo.width || 400}"
            height="${photo.height || 300}"
          >
          <div class="masonry-overlay">
            <span class="masonry-title">${displayTitle}</span>
            <span class="masonry-view">View -></span>
          </div>
        `;
      } else {
        imageHtml = renderPlaceholder('No thumbnail');
      }
      
      // Calculate aspect class from actual image dimensions
      const w = photo.width || 400;
      const h = photo.height || 300;
      let aspectClass = 'square';
      if (h > w * 1.4) aspectClass = 'tall';
      else if (w > h * 1.4) aspectClass = 'wide';
      
      return `
        <a href="/photo/${photo.slug}" class="${cardClass} ${aspectClass}" data-index="${index}" data-slug="${photo.slug}">
          ${imageHtml}
        </a>
      `;
    }).join('');
    
    photoContent = `
      <div class="masonry-grid" id="gallery-grid">
        ${photoCards}
      </div>
      ${hasMore ? `<div id="load-more" class="load-more-container"><button id="load-more-btn" class="load-more-btn">Load more images</button></div>` : ''}
      <div class="masonry-footer">
        <p>Showing <span id="photo-count">${photos.length}</span> of ${totalCount} photos</p>
      </div>
      <div id="sentinel" class="sentinel"></div>
    `;
  } else {
    photoContent = `
      <div class="empty-gallery">
        <p>No photos in this gallery yet.</p>
      </div>
    `;
  }
  
  // Resolve destination from gallery name/slug for affiliate matching
  const galleryNameLower = (galleryName || '').toLowerCase();
  let matchedHub: any = null;
  
  for (const [hubSlug, hubData] of Object.entries(DESTINATION_HUBS)) {
    if (galleryNameLower.includes(hubSlug) || 
        (hubData as any).aliases?.some((a: string) => galleryNameLower.includes(a))) {
      matchedHub = (hubData as any);
      break;
    }
  }
  
  // Build affiliate blocks — GetYourGuide only
  let affiliateBlocks = '';
  if (matchedHub) {
    affiliateBlocks += renderGYGWidget(matchedHub.name);
  } else {
    affiliateBlocks = renderGYGWidget('Costa Rica');
  }
  
  // Viator and Amazon/Hotels blocks removed — GetYourGuide only
  
  const content = `
    <a href="/" class="back-link">← Back to Galleries</a>
    ${parentGalleryHtml ? `<div class="parent-gallery-nav">${parentGalleryHtml}</div>` : ''}

    <header class="gallery-header">
      <h1>${galleryName}</h1>
      ${galleryDescription ? `<p class="gallery-desc">${galleryDescription}</p>` : ''}
    </header>

    ${relatedGalleriesHtml}
    ${speciesLinksHtml}

    ${affiliateBlocks}
    
    ${photoContent}
    
    <script>
      // Infinite scroll state
      var loading = false;
      var offset = ${INITIAL_LOAD};
      var hasMore = ${hasMore};
      var gallerySlug = '${slug}';
      var totalCount = ${totalCount};
      
      // Load more photos from API
      async function loadMorePhotos() {
        if (loading || !hasMore) return;
        loading = true;
        
        var btn = document.getElementById('load-more-btn');
        if (btn) {
          btn.innerHTML = '<span class="spinner"></span> Loading...';
          btn.disabled = true;
        }
        
        try {
          var response = await fetch('/api/gallery-photos?slug=' + gallerySlug + '&offset=' + offset + '&limit=20');
          var data = await response.json();
          
          if (data.photos && data.photos.length > 0) {
            var grid = document.getElementById('gallery-grid');
            
            data.photos.forEach(function(photo, index) {
              var card = document.createElement('a');
              card.href = '/photo/' + photo.slug;
              card.className = 'masonry-item';
              card.setAttribute('data-index', offset + index);
              card.setAttribute('data-slug', photo.slug);
              
              var aspectClass = (offset + index) % 3 === 0 ? 'tall' : (offset + index) % 2 === 0 ? 'wide' : 'square';
              card.classList.add(aspectClass);
              
              var imgUrl = photo.small_url || photo.medium_url || photo.thumb_url || '';
              var width = photo.width || 400;
              var height = photo.height || 300;
              
              var imgHtml = imgUrl 
                ? '<img src="' + imgUrl + '" alt="" loading="lazy" decoding="async" class="masonry-img" width="' + width + '" height="' + height + '">' +
                  '<div class="masonry-overlay"><span class="masonry-title">' + (photo.title || 'Photo') + '</span><span class="masonry-view">View -></span></div>'
                : '<div class="image-placeholder">No thumbnail</div>';
              
              card.innerHTML = imgHtml;
              grid.appendChild(card);
            });
            
            offset = data.offset;
            hasMore = data.hasMore;
            totalCount = data.total;
            
            // Update count
            var countEl = document.getElementById('photo-count');
            if (countEl) countEl.textContent = offset;
            
            // Update footer
            var footer = document.querySelector('.masonry-footer p');
            if (footer) footer.innerHTML = 'Showing <span id="photo-count">' + offset + '</span> of ' + totalCount + ' photos';
          }
          
          if (!hasMore) {
            var loadMore = document.getElementById('load-more');
            if (loadMore) loadMore.style.display = 'none';
          }
          
        } catch (e) {
          console.error('Error loading more photos:', e);
          if (btn) btn.innerHTML = 'Error. Click to retry';
        }
        
        loading = false;
        if (btn) {
          btn.innerHTML = 'Load more images';
          btn.disabled = false;
        }
      }
      
      // Load more button click handler
      var loadBtn = document.getElementById('load-more-btn');
      if (loadBtn) {
        loadBtn.addEventListener('click', loadMorePhotos);
      }
      
      // Infinite scroll with IntersectionObserver
      var sentinel = document.getElementById('sentinel');
      if (sentinel && hasMore) {
        var observer = new IntersectionObserver(function(entries) {
          if (entries[0].isIntersecting && !loading && hasMore) {
            loadMorePhotos();
          }
        }, { rootMargin: '300px' });
        observer.observe(sentinel);
      }
    </script>
    
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
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 0.75rem;
        padding: 0 0.5rem;
        max-width: 1800px;
        margin: 0 auto;
      }
      
      @media (min-width: 640px) {
        .masonry-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
      }
      
      @media (min-width: 1024px) {
        .masonry-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
      }
      
      .masonry-item {
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
      
      /* Square items: natural height */
      .masonry-item.square .masonry-img {
        width: 100%;
        height: 220px;
        object-fit: cover;
      }
      
      /* Tall items (portrait): span 2 rows */
      .masonry-item.tall {
        grid-row: span 2;
      }
      .masonry-item.tall .masonry-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      /* Wide items (panorama): span 2 columns */
      .masonry-item.wide {
        grid-column: span 2;
      }
      .masonry-item.wide .masonry-img {
        width: 100%;
        height: 220px;
        object-fit: cover;
      }
      
      .masonry-img {
        width: 100%;
        height: 220px;
        object-fit: cover;
        display: block;
        transition: transform 0.4s ease;
        /* Fix image orientation - let browser handle EXIF */
        image-orientation: from-image;
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
      
      /* Load more button */
      .load-more-container {
        text-align: center;
        padding: 1.5rem;
      }
      
      .load-more-btn {
        background: #333;
        color: white;
        border: none;
        padding: 1rem 2rem;
        font-size: 1rem;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .load-more-btn:hover {
        background: #555;
      }
      
      .load-more-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      
      .load-more-btn .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid #fff;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        vertical-align: middle;
        margin-right: 0.5rem;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* Sentinel for infinite scroll */
      .sentinel {
        height: 1px;
        margin: 100px 0;
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

      /* Internal linking sections */
      .parent-gallery-nav {
        padding: 0.5rem 1rem;
        background: #f0f4f8;
        border-bottom: 1px solid #e2e8f0;
      }
      .gallery-breadcrumb-link {
        color: #4a6fa5;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 500;
      }
      .gallery-breadcrumb-link:hover {
        text-decoration: underline;
      }
      .internal-links-section {
        margin: 1rem auto;
        padding: 1rem 1.5rem;
        max-width: 1100px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #2c7a7b;
      }
      .internal-links-section h3 {
        font-size: 1rem;
        color: #1a365d;
        margin: 0 0 0.75rem;
        font-weight: 600;
      }
      .related-gallery-links,
      .species-gallery-links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .related-gallery-chip,
      .species-gallery-chip {
        display: inline-block;
        padding: 0.35rem 0.8rem;
        background: white;
        border: 1px solid #cbd5e0;
        border-radius: 20px;
        color: #2d3748;
        text-decoration: none;
        font-size: 0.85rem;
        transition: background 0.2s;
      }
      .related-gallery-chip:hover,
      .species-gallery-chip:hover {
        background: #e2e8f0;
        border-color: #a0aec0;
      }
      
      /* Image placeholder */
      .image-placeholder {
        width: 100%;
        height: 220px;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #999;
        font-size: 14px;
      }
      
      /* Affiliate Monetization Blocks */
      .gyg-widget-container {
        margin: 2rem auto;
        padding: 1.5rem;
        max-width: 1100px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 12px;
      }
      .gyg-widget-container h3 {
        font-size: 1.4rem;
        margin-bottom: 1rem;
        color: #1a1a1a;
        text-align: center;
      }
    </style>
  `;
  
  // SEO options
  const canonical = `https://wildphotography.com/gallery/${slug}`;
  const description = galleryDescription 
    ? `${galleryName} - ${galleryDescription.substring(0, 150)}`
    : `Browse ${totalCount} professional ${galleryName.toLowerCase()} photos from Costa Rica by Joshua ten Brink`;
  const ogImage = photos[0]?.small_r2_key 
    ? `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/${photos[0].small_r2_key}` 
    : '';
  
  // JSON-LD for collection page
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": galleryName,
    "description": galleryDescription || `${galleryName} photography collection`,
    "url": canonical,
    "image": ogImage || undefined,
    "primaryImageOfPage": ogImage ? {
      "@type": "ImageObject",
      "url": ogImage
    } : undefined,
    "creator": {
      "@type": "Person",
      "name": "Joshua ten Brink"
    }
  });
  
  return layout(`${galleryName} - Wildphotography`, content, '', '', {
    canonical,
    description,
    ogImage,
    ogType: 'website',
    jsonLd
  });
}
