/**
 * Search page renderer
 */

import { renderPage } from './base';
import type { Env } from '../types';

export async function renderSearch(env: Env, url: URL): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  
  // TODO: Connect to Typesense when Phase B4
  // const results = await searchTypesense(query);
  
  let resultsHtml = '';
  if (query) {
    resultsHtml = `
      <p>Searching for: "${query}"</p>
      <p style="color:#666;margin-top:1rem">Search results would appear here (Phase B4)</p>
    `;
  }
  
  const content = `
    <h2>Search Photos</h2>
    <form action="/search" method="get">
      <input type="text" name="q" placeholder="Search photos..." value="${query}" autofocus>
      <button type="submit">Search</button>
    </form>
    ${resultsHtml}
    <p style="text-align:center;color:#666;margin-top:2rem">
      Try: bird, macaw, landscape, surf, turtle
    </p>
  `;
  
  return renderPage('Search | Wildphotography', content);
}
