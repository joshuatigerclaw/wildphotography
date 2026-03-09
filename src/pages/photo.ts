/**
 * Photo page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import { getPhotoBySlug } from '../lib/db';
import type { Env } from '../types';

export async function renderPhoto(slug: string, env: Env, url: URL): Promise<Response> {
  const photo = await getPhotoBySlug(slug);
  
  if (!photo) {
    return renderPage('Photo Not Found', `
      <h2>Photo Not Found</h2>
      <p>The photo "${slug}" doesn't exist.</p>
      <p><a href="/">← Back to Home</a></p>
    `);
  }
  
  const content = `
    <a href="/" class="back-link">← Home</a>
    <div style="text-align:center;padding:2rem 0">
      <img src="${MEDIA_BASE}/derivatives/large/${photo.filename.replace('.jpg', '-large.jpg')}" alt="${photo.title}" style="max-width:100%;border-radius:8px;">
      <h2 style="margin:1rem 0">${photo.title}</h2>
      ${photo.description ? `<p style="color:#666">${photo.description}</p>` : ''}
      ${photo.locationName ? `<p style="color:#666;margin-top:0.5rem">📍 ${photo.locationName}</p>` : ''}
    </div>
  `;
  
  return renderPage(`${photo.title} | Wildphotography`, content);
}
