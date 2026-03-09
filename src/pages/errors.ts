/**
 * Error pages
 */

import { layout } from './base';

export function render404(): Response {
  const html = layout('404 Not Found', `
    <div style="text-align:center;padding:4rem 0">
      <h2>Page Not Found</h2>
      <p style="margin-top:1rem;color:#666">The page you're looking for doesn't exist.</p>
      <p style="margin-top:2rem"><a href="/" style="color:#0066cc">← Back to Home</a></p>
    </div>
  `);
  
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html' } });
}

export function render403(): Response {
  const html = layout('403 Forbidden', `
    <div style="text-align:center;padding:4rem 0">
      <h2>Forbidden</h2>
      <p style="margin-top:1rem;color:#666">You don't have access to this resource.</p>
    </div>
  `);
  
  return new Response(html, { status: 403, headers: { 'Content-Type': 'text/html' } });
}
