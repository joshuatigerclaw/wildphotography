/**
 * Homepage renderer - Enhanced Discovery Hub
 */

import { layout, MEDIA_BASE } from './base';
import { getPhotosBatch, queryNeon } from '../lib/db';
import type { Env } from '../types';

const INITIAL_LOAD = 24;

export async function renderHome(env: Env, url: URL): Promise<Response> {
  const photos = await getPhotosBatch(0);
  const displayPhotos = photos.slice(0, INITIAL_LOAD);
  
  // Featured species - dynamically fetched from DB with real thumbnails
  const speciesRows = await queryNeon<any>(`
    SELECT 
      species_common_name, 
      COUNT(*) as photo_count,
      MIN(small_url) as sample_url
    FROM photos 
    WHERE species_common_name IS NOT NULL 
      AND species_common_name != ''
      AND ready_for_public_render = true
      AND small_url IS NOT NULL
    GROUP BY species_common_name 
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
    LIMIT 6
  `);
  
  const featuredSpecies = speciesRows.map((r: any) => {
    const slug = r.species_common_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return {
      slug,
      name: r.species_common_name,
      image: r.sample_url
    };
  });
  
  // Gallery-based regions (top galleries with most photos)
  const regionRows = await queryNeon<any>(`
    SELECT g.slug, g.name, p.small_url, COUNT(gp.photo_id) as photo_count
    FROM galleries g
    JOIN gallery_photos gp ON g.id = gp.gallery_id
    JOIN photos p ON gp.photo_id = p.id AND p.ready_for_public_render = true AND p.small_url IS NOT NULL
    WHERE g.is_active = true
    GROUP BY g.id, g.slug, g.name, p.small_url
    ORDER BY photo_count DESC
    LIMIT 4
  `);
  
  // Deduplicate by gallery slug, keeping first image
  const regionMap = new Map<string, any>();
  for (const r of regionRows) {
    if (!regionMap.has(r.slug)) {
      regionMap.set(r.slug, { slug: r.slug, name: r.name, image: r.small_url });
    }
  }
  const regions = Array.from(regionMap.values());
  
  // Published articles from content_articles table
  const articleRows = await queryNeon<any>(`
    SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt
    FROM content_articles ca
    WHERE ca.status = 'published'
    ORDER BY ca.updated_at DESC
    LIMIT 6
  `);
  
  const articles = articleRows.map((r: any) => {
    const typeLabel = r.article_type ? r.article_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Guide';
    const excerpt = r.excerpt ? r.excerpt.substring(0, 80) + (r.excerpt.length > 80 ? '...' : '') : '';
    return {
      slug: r.slug,
      title: r.title,
      desc: excerpt,
      type: typeLabel
    };
  });
  
  // Build photo cards
  const photoCards = displayPhotos.slice(0, 12).map((photo: any) => {
    const imgUrl = photo.small_url || '';
    const displayTitle = photo.title || photo.gallery_name || 'Photo';
    return `
      <a href="/photo/${photo.slug}" class="photo-card">
        <img src="${imgUrl}" alt="" loading="lazy" width="400" height="300">
        <div class="photo-meta">${displayTitle}</div>
      </a>
    `;
  }).join('');
  
  const speciesCards = featuredSpecies.map(s => `
    <a href="/species/${s.slug}" class="card">
      <img src="${s.image}" alt="${s.name}" loading="lazy" onerror="this.style.display='none'">
      <div class="card-content">
        <div class="card-title">${s.name}</div>
        <span class="card-link">View Species -></span>
      </div>
    </a>
  `).join('');
  
  const regionCards = regions.map(r => `
    <a href="/region/${r.slug}" class="card">
      <div class="card-content">
        <div class="card-title">${r.name}</div>
        <div class="card-desc">${r.desc}</div>
        <span class="card-link">Explore Region -></span>
      </div>
    </a>
  `).join('');
  
  const articleCards = articles.map((a: any) => `
    <a href="/article/${a.slug}" class="card">
      <div class="card-content">
        <div class="card-type">${a.type}</div>
        <div class="card-title">${a.title}</div>
        ${a.desc ? `<div class="card-desc">${a.desc}</div>` : ''}
        <span class="card-link">Read Guide -></span>
      </div>
    </a>
  `).join('');
  
  const content = `
    <div class="hero">
      <h1>WildPhotography</h1>
      <p>Professional wildlife & nature photography from Costa Rica</p>
    </div>
    
    <section>
      <h2 class="section-title">Featured Species</h2>
      <div class="card-grid">
        ${speciesCards}
      </div>
      <div style="text-align: center; margin-top: 1.5rem;">
        <a href="/species" style="color: #2c7a7b; font-weight: 500;">View All Species -></a>
      </div>
    </section>
    
    <section>
      <h2 class="section-title">Photo Galleries</h2>
      <div class="card-grid">
        ${regionCards}
      </div>
      <div style="text-align: center; margin-top: 1.5rem;">
        <a href="/galleries" style="color: #2c7a7b; font-weight: 500;">View All Galleries -></a>
      </div>
    </section>
    
    ${articles.length > 0 ? `
    <section>
      <h2 class="section-title">Articles & Guides</h2>
      <div class="card-grid">
        ${articleCards}
      </div>
      <div style="text-align: center; margin-top: 1.5rem;">
        <a href="/article" style="color: #2c7a7b; font-weight: 500;">View All Articles -></a>
      </div>
    </section>
    ` : ''}
    
    <section>
      <h2 class="section-title">Latest Photos</h2>
      <div class="photo-grid">
        ${photoCards}
      </div>
    </section>
  `;
  
  const title = 'WildPhotography - Professional Wildlife Photography from Costa Rica';
  const description = 'Explore stunning wildlife photography from Costa Rica. Discover bird species, birding regions, and travel guides.';
  
  return layout(title, content, '', '', {
    canonical: 'https://wildphotography.com/',
    description
  });
}
