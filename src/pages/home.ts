/**
 * Homepage renderer - Enhanced Discovery Hub
 * Uses queryNeon tagged template syntax
 */

import { layout } from './base';
import { queryNeon, getPhotosBatch } from '../lib/db';
import type { Env } from '../types';

export async function renderHome(env: Env, url: URL): Promise<Response> {
  // Photos for hero/featured section
  const photos = await getPhotosBatch(0);
  const displayPhotos = photos.slice(0, 12);

  // Featured species
  const speciesRows = await queryNeon<any>`
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
  `;

  const featuredSpecies = speciesRows.map((r: any) => {
    const slug = r.species_common_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return { slug, name: r.species_common_name, image: r.sample_url };
  });

  // Gallery-based regions
  const regionRows = await queryNeon<any>`
    SELECT g.slug, g.name, p.small_url, COUNT(gp.photo_id) as photo_count
    FROM galleries g
    JOIN gallery_photos gp ON g.id = gp.gallery_id
    JOIN photos p ON gp.photo_id = p.id AND p.ready_for_public_render = true AND p.small_url IS NOT NULL
    WHERE g.is_active = true
    GROUP BY g.id, g.slug, g.name, p.small_url
    ORDER BY photo_count DESC
    LIMIT 8
  `;

  const regionMap = new Map<string, any>();
  for (const r of regionRows) {
    if (!regionMap.has(r.slug)) {
      regionMap.set(r.slug, { slug: r.slug, name: r.name, image: r.small_url });
    }
  }
  const regions = Array.from(regionMap.values());

  // Build photo cards
  const photoCards = displayPhotos.map((photo: any) => {
    const imgUrl = photo.small_url || '';
    const displayTitle = photo.title || photo.gallery_name || 'Photo';
    return '<a href="/photo/' + photo.slug + '" class="photo-card"><img src="' + imgUrl + '" alt="" loading="lazy" width="400" height="300"><div class="photo-meta">' + displayTitle + '</div></a>';
  }).join('');

  const speciesCards = featuredSpecies.map((s: any) =>
    '<a href="/species/' + s.slug + '" class="card"><img src="' + (s.image || '') + '" alt="' + s.name + '" loading="lazy" onerror="this.style.display=\'none\'"><div class="card-content"><div class="card-title">' + s.name + '</div><span class="card-link">View Species -&gt;</span></div></a>'
  ).join('');

  const regionCards = regions.map((r: any) =>
    '<a href="/region/' + r.slug + '" class="card"><div class="card-content"><div class="card-title">' + r.name + '</div><span class="card-link">Explore Region -&gt;</span></div></a>'
  ).join('');

  const content = '<div class="hero"><h1>WildPhotography</h1><p>Professional wildlife &amp; nature photography from Costa Rica</p></div><section><h2 class="section-title">Featured Species</h2><div class="card-grid">' + speciesCards + '</div><div style="text-align:center;margin-top:1.5rem"><a href="/species" style="color:#2c7a7b;font-weight:500">View All Species -&gt;</a></div></section><section><h2 class="section-title">Photo Galleries</h2><div class="card-grid">' + regionCards + '</div><div style="text-align:center;margin-top:1.5rem"><a href="/galleries" style="color:#2c7a7b;font-weight:500">View All Galleries -&gt;</a></div></section><section><h2 class="section-title">Latest Photos</h2><div class="photo-grid">' + photoCards + '</div></section>';

  const extraHead = '<link rel="preconnect" href="https://images.wildphotography.com">';
  const response = layout('WildPhotography - Professional Wildlife Photography from Costa Rica', content, extraHead);
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
  return response;
}