/**
 * GetYourGuide Affiliate Redirect Page
 * Route: /go/gyg/:slug → redirect to real GYG URL
 */

import type { Env } from "../types";

export async function renderGYGRedirect(slug: string, env: Env): Promise<Response> {
  const safeSlug = slug.replace(/'/g, "''");

  try {
    const { queryNeon } = await import("../lib/db");
    const rows = await queryNeon<any>(`
      SELECT id, title, affiliate_redirect_url, url as pretty_link, label,
             price_if_available, rating_if_available, review_count_if_available, duration_if_available
      FROM affiliate_offers
      WHERE source = 'getyourguide'
        AND (affiliate_redirect_url LIKE '%${safeSlug}%' OR url LIKE '%${safeSlug}%')
        AND is_active = true
      LIMIT 1
    `);

    const offer = rows[0];

    if (offer) {
      const redirectUrl = offer.affiliate_redirect_url || offer.pretty_link || `https://www.getyourguide.com/6ZV7KMH/costa-rica-tours`;
      const stars = offer.rating_if_available ? "⭐".repeat(Math.round(parseFloat(offer.rating_if_available))) : "";

      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting to GetYourGuide: ${(offer.title || '').replace(/</g, '&lt;')} | WildPhotography</title>
<meta name="description" content="Book ${(offer.title || 'this tour').replace(/</g, '&lt;')} — recommended by WildPhotography. Part of our Costa Rica travel affiliate.">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f9f9}
  .card{background:white;border-radius:16px;padding:2.5rem;max-width:500px;width:92%;text-align:center;box-shadow:0 4px 32px rgba(44,122,123,0.12)}
  .badge{display:inline-block;background:#2c7a7b;color:white;padding:0.3rem 0.9rem;border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1.2rem}
  h1{color:#1a365d;font-size:1.5rem;font-weight:700;margin:0 0 0.6rem 0;line-height:1.25}
  .subtitle{color:#718096;font-size:0.9rem;margin:0 0 1rem 0;line-height:1.5}
  .meta{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.5rem}
  .meta-item{font-size:0.85rem;color:#4a5568;background:#f0f9f9;padding:0.4rem 0.8rem;border-radius:6px}
  .meta-item strong{color:#1a365d}
  .cta{display:inline-block;background:#2c7a7b;color:white;padding:0.85rem 2.2rem;border-radius:10px;text-decoration:none;font-weight:700;font-size:1.05rem;transition:background 0.2s;box-shadow:0 2px 8px rgba(44,122,123,0.3)}
  .cta:hover{background:#236c6d;text-decoration:none}
  .footer{color:#cbd5e0;font-size:0.78rem;margin-top:1.5rem;line-height:1.6}
  .bar{width:100%;height:4px;background:#e2e8f0;border-radius:2px;margin-top:1.8rem;overflow:hidden}
  .bar-fill{height:100%;background:linear-gradient(90deg,#2c7a7b,#38b2ac);width:0;animation:load 1.8s ease forwards}
  @keyframes load{to{width:100%}}
  .disclaimer{margin-top:1rem;font-size:0.72rem;color:#a0aec0}
</style>
<meta http-equiv="refresh" content="2;url=${redirectUrl}">
</head>
<body>
<div class="card">
  <span class="badge">WildPhotography Recommended</span>
  <h1>${offer.title || 'Book Your Costa Rica Tour'}</h1>
  <p class="subtitle">You're being redirected to the booking page with our partner link.</p>
  <div class="meta">
    ${offer.duration_if_available ? `<span class="meta-item">⏱ ${offer.duration_if_available}</span>` : ''}
    ${offer.price_if_available ? `<span class="meta-item">💰 ${offer.price_if_available}</span>` : ''}
    ${offer.rating_if_available ? `<span class="meta-item">${stars} ${offer.rating_if_available}</span>` : ''}
    ${offer.review_count_if_available ? `<span class="meta-item">(${offer.review_count_if_available} reviews)</span>` : ''}
  </div>
  <a href="${redirectUrl}" class="cta">Book on GetYourGuide →</a>
  <p class="footer">WildPhotography earns a small commission at no extra cost to you.<br>Your booking supports our Costa Rica wildlife photography work.</p>
  <div class="bar"><div class="bar-fill"></div></div>
  <p class="disclaimer">Redirecting in 2 seconds... <a href="${redirectUrl}" style="color:#2c7a7b">Click here if not redirected</a></p>
</div>
</body></html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        }
      });
    }
  } catch (e) {
    console.error("[GYG redirect] DB error:", e);
  }

  // 404 fallback
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tour Not Found | WildPhotography</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}
  .card{background:white;border-radius:16px;padding:2.5rem;max-width:420px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
  h1{color:#1a365d;font-size:1.5rem;margin:0 0 0.75rem 0}
  p{color:#888;margin:0 0 1.5rem 0}
  a{color:#2c7a7b;font-weight:600;text-decoration:none}
</style>
</head>
<body>
<div class="card">
  <h1>Tour Not Found</h1>
  <p>This offer is no longer available. <a href="/">Return to WildPhotography →</a></p>
</div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: 404
  });
}
