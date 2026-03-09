/**
 * Photo page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import type { Env } from '../types';

const FALLBACK = [
  { title: 'IMG_9761', slug: 'img_9761' },
];

export async function renderPhoto(slug: string, env: Env, url: URL): Promise<Response> {
  // Try to get photo from API
  let photo: any = null;
  
  try {
    const response = await fetch('https://wildphotography.com/api/public/photos/' + slug);
    if (response.ok) {
      photo = await response.json();
    }
  } catch (e) {
    console.error('Photo error:', e);
  }
  
  if (!photo) {
    photo = FALLBACK[0];
  }
  
  // Use large derivative
  const imageUrl = `${MEDIA_BASE}/derivatives/large/${slug}-large.jpg`;
  
  const content = `
    <a href="/gallery/surfing-costa-rica" class="back-link">← Gallery</a>
    <div style="text-align:center;padding:2rem 0">
      <img src="${imageUrl}" alt="${photo.title}" style="max-width:100%;border-radius:8px;">
      <h2 style="margin:1rem 0">${photo.title}</h2>
      ${photo.description ? `<p style="color:#666">${photo.description}</p>` : ''}
      ${photo.location ? `<p style="color:#666;margin-top:0.5rem">📍 ${photo.location}</p>` : ''}
    </div>
  `;
  
  return renderPage(`${photo.title} | Wildphotography`, content);
}
