/**
 * TripAdvisor Affiliate Redirect Page
 * Route: /go/tripadvisor → redirect through affiliate tracking link
 */

export function renderTripadvisorRedirect(): Response {
  const TRACKING_URL = "https://www.kqzyfj.com/76116cy63y5LNMNRNTOUSLNRQRVRRU";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting to TripAdvisor... | WildPhotography</title>
<meta name="description" content="Browse 300,000+ Costa Rica tours and activities on TripAdvisor — trusted by millions of travelers.">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7fffe}
  .card{background:white;border-radius:16px;padding:2.5rem;max-width:500px;width:92%;text-align:center;box-shadow:0 4px 32px rgba(0,175,135,0.12)}
  .badge{display:inline-block;background:#00AF87;color:white;padding:0.3rem 0.9rem;border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1.2rem}
  h1{color:#1a365d;font-size:1.5rem;font-weight:700;margin:0 0 0.5rem 0}
  p{color:#718096;font-size:0.95rem;margin:0 0 1.5rem 0;line-height:1.6}
  .stats{display:flex;gap:1.5rem;justify-content:center;margin-bottom:1.5rem;flex-wrap:wrap}
  .stat{text-align:center}
  .stat-num{font-size:1.4rem;font-weight:700;color:#1a365d}
  .stat-label{font-size:0.72rem;color:#888;text-transform:uppercase;letter-spacing:0.05em}
  .cta{display:inline-block;background:#00AF87;color:white;padding:0.85rem 2.2rem;border-radius:10px;text-decoration:none;font-weight:700;font-size:1.05rem;transition:background 0.2s;box-shadow:0 2px 8px rgba(0,175,135,0.3)}
  .cta:hover{background:#008c6e;text-decoration:none}
  .footer{color:#cbd5e0;font-size:0.78rem;margin-top:1.5rem;line-height:1.6}
  .bar{width:100%;height:4px;background:#e2e8f0;border-radius:2px;margin-top:1.8rem;overflow:hidden}
  .bar-fill{height:100%;background:linear-gradient(90deg,#00AF87,#38b2ac);width:0;animation:load 1.8s ease forwards}
  @keyframes load{to{width:100%}}
  .disclaimer{margin-top:1rem;font-size:0.72rem;color:#a0aec0}
</style>
<meta http-equiv="refresh" content="2;url=${TRACKING_URL}">
</head>
<body>
<div class="card">
  <span class="badge">300,000+ Tours & Activities</span>
  <h1>Book on TripAdvisor</h1>
  <p>Trusted reviews from real travelers. Find the perfect Costa Rica experience for your trip.</p>
  <div class="stats">
    <div class="stat"><div class="stat-num">300K+</div><div class="stat-label">Tours</div></div>
    <div class="stat"><div class="stat-num">5★</div><div class="stat-label">Trusted</div></div>
    <div class="stat"><div class="stat-num">Free</div><div class="stat-label">Cancellation</div></div>
    <div class="stat"><div class="stat-num">190+</div><div class="stat-label">Countries</div></div>
  </div>
  <a href="${TRACKING_URL}" class="cta">Browse TripAdvisor →</a>
  <p class="footer">WildPhotography earns a small commission at no extra cost to you.<br>Your booking supports our Costa Rica wildlife photography work.</p>
  <div class="bar"><div class="bar-fill"></div></div>
  <p class="disclaimer">Redirecting in 2 seconds... <a href="${TRACKING_URL}" style="color:#00AF87">Click here if not redirected</a></p>
</div>
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    }
  });
}
