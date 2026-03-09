/**
 * Photo page renderer
 */

import { renderPage, MEDIA_BASE } from './base';
import type { Env } from '../types';

export async function renderPhoto(slug: string, env: Env, url: URL): Promise<Response> {
  // TODO: Fetch from Neon DB when Phase B3
  // const photo = await getPhotoBySlug(slug);
  
  const content = `
    <a href="/" class="back-link">← Home</a>
    <div style="text-align:center;padding:2rem 0">
      <img src="${MEDIA_BASE}/derivatives/large/scarlet-macaw-test-large.jpg" alt="${slug}" style="max-width:100%;border-radius:8px;">
      <p style="margin-top:1rem"><a href="${MEDIA_BASE}/derivatives/originals/scarlet-macaw-test.jpg" style="color:#0066cc">View Full Size</a></p>
    </div>
  `;
  
  return renderPage(`${slug} | Wildphotography`, content);
}
