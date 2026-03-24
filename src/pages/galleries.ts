/**
 * Galleries page - Speed Optimized with Infinite Scroll
 */

import { layout, MEDIA_BASE } from './base';
import type { Env } from '../types';

const INITIAL_LOAD = 24;

export async function renderGalleries(env: Env, url: URL): Promise<Response> {
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  
  const { queryNeon } = await import('../lib/db');
  
  const rows = await queryNeon<any>(`
    SELECT g.id, g.slug, g.name, g.description, g.cover_photo_id,
      p.small_url, p.medium_url
    FROM galleries g
    LEFT JOIN LATERAL (
      SELECT p.small_url, p.medium_url
      FROM gallery_photos gp
      JOIN photos p ON gp.photo_id = p.id
      WHERE gp.gallery_id = g.id 
        AND p.is_active = true 
        AND p.ready_for_public_render = true
        AND p.small_url IS NOT NULL
      LIMIT 1
    ) p ON true
    WHERE g.is_active = true
    ORDER BY g.name
    LIMIT ${INITIAL_LOAD + 1}
    OFFSET ${offset}
  `);
  
  const hasMore = rows.length > INITIAL_LOAD;
  const galleries = rows.slice(0, INITIAL_LOAD);
  
  const cards = galleries.map(g => {
    const title = g.name || 'Gallery';
    const slug = g.slug;
    const description = (g.description || '').trim();
    const descText = description ? description.substring(0, 60) + (description.length > 60 ? '...' : '') : '';
    
    const imgUrl = g.small_url || g.medium_url || '';
    
    const imgHtml = imgUrl 
      ? '<img src="' + imgUrl + '" alt="' + title + '" loading="lazy" width="300" height="225">'
      : '<div class="ph"></div>';
    
    const descHtml = descText ? '<p>' + descText + '</p>' : '';
    
    return '<a href="/gallery/' + slug + '" class="c"><div class="i">' + imgHtml + '</div><div class="t"><h3>' + title + '</h3>' + descHtml + '</div></a>';
  }).join('');
  
  // Infinite scroll JavaScript
  const js = hasMore ? `
  <script>
    var loading = false;
    var offset = ${INITIAL_LOAD};
    var hasMore = true;
    
    function loadMore() {
      if (loading || !hasMore) return;
      loading = true;
      document.getElementById('load-more').innerHTML = '<span class="spinner"></span> Loading...';
      
      fetch('/api/galleries?offset=' + offset)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.galleries && data.galleries.length > 0) {
            var grid = document.querySelector('.g');
            data.galleries.forEach(function(g) {
              var card = document.createElement('a');
              card.href = '/gallery/' + g.slug;
              card.className = 'c';
              var img = g.small_url || g.medium_url || '';
              var imgHtml = img 
                ? '<div class="i"><img src="' + img + '" alt="" loading="lazy" width="300" height="225"></div>'
                : '<div class="i"><div class="ph"></div></div>';
              var desc = g.description ? '<p>' + g.description.substring(0,60) + (g.description.length>60?'...':'') + '</p>' : '';
              card.innerHTML = imgHtml + '<div class="t"><h3>' + g.name + '</h3>' + desc + '</div>';
              grid.appendChild(card);
            });
            offset += data.galleries.length;
            hasMore = data.hasMore;
          } else {
            hasMore = false;
          }
          
          if (!hasMore) {
            document.getElementById('load-more').style.display = 'none';
          } else {
            document.getElementById('load-more').innerHTML = 'Load more galleries';
          }
          loading = false;
        })
        .catch(function(e) {
          console.error(e);
          document.getElementById('load-more').innerHTML = 'Error. <a href="#" onclick="loadMore();return false">Retry</a>';
          loading = false;
        });
    }
    
    var loadBtn = document.getElementById('load-more');
    if (loadBtn) {
      var observer = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) loadMore();
      }, { rootMargin: '200px' });
      observer.observe(loadBtn);
    }
  </script>` : '';
  
  const content = '<div class="h"><h1>Photo Galleries</h1><p>Curated nature photography from Costa Rica.</p></div><div class="g">' + cards + '</div>' + (hasMore ? '<div id="load-more" class="load-more">Load more galleries</div>' : '') + js;
  
  const css = '.h{text-align:center;padding:2rem 1rem}.h h1{font-size:2.25rem;font-weight:700;margin:0 0 .5rem;color:#1a1a1a}.h p{font-size:1rem;color:#666;margin:0}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;padding:1.5rem 2rem;max-width:1100px;margin:0 auto}.c{background:#fff;border-radius:10px;overflow:hidden;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:transform .2s,box-shadow .2s;display:block}.c:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.12)}.i{aspect-ratio:4/3;background:#e8e8e8;overflow:hidden}.i img{width:100%;height:100%;object-fit:cover;display:block}.i .ph{width:100%;height:100%;background:linear-gradient(135deg,#e0e0e0,#c8c8c8)}.t{padding:.875rem 1rem}.t h3{font-size:.95rem;font-weight:600;margin:0 0 .35rem;color:#1a1a1a;line-height:1.3}.t p{font-size:.8rem;color:#666;margin:0;line-height:1.4}.load-more{display:block;text-align:center;padding:1.5rem;margin:1rem auto;max-width:200px;background:#333;color:white;border-radius:8px;text-decoration:none;font-size:1rem;cursor:pointer}.load-more:hover{background:#555}.spinner{display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:.5rem}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.g{grid-template-columns:repeat(2,1fr);padding:1rem;gap:.75rem}.h h1{font-size:1.75rem}.t{padding:.6rem .75rem}.t h3{font-size:.85rem}}';
  
  const response = layout('Photo Galleries | Wildphotography', content, '', css, {
    canonical: 'https://wildphotography.com/galleries',
    description: 'Browse curated photo galleries featuring wildlife, landscapes, and nature photography from Costa Rica by Joshua ten Brink.'
  });
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
  return response;
}
