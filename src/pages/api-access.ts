/**
 * API Access Landing Page
 * WildPhotography.com — Phase 9
 */

import type { Env } from '../types';

export async function renderApiAccess(env: Env): Promise<Response> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WildPhotography API — Programmatic Access to Costa Rica Wildlife Images</title>
  <meta name="description" content="Access verified real Costa Rica wildlife and travel photography through a developer-friendly API. Built for automated content workflows, AI agents, and tourism platforms.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#0f0f0f;--bg2:#181818;--bg3:#222;--text:#f0ede6;--text-muted:#8a8680;--accent:#c9a84c;--accent-dim:#8a6d2f;--border:#2a2a2a;--green:#4ade80;--red:#f87171}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
    a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1120px;margin:0 auto;padding:0 24px}
    nav{padding:20px 0;border-bottom:1px solid var(--border)}
    nav .container{display:flex;justify-content:space-between;align-items:center}
    .logo{font-size:20px;font-weight:700;letter-spacing:-0.5px}.logo span{color:var(--accent)}
    .nav-links{display:flex;gap:32px;font-size:14px}.nav-links a{color:var(--text-muted)}.nav-links a:hover{color:var(--text);text-decoration:none}
    .hero{padding:96px 0 80px;text-align:center}
    .hero h1{font-size:clamp(40px,6vw,72px);font-weight:700;line-height:1.1;letter-spacing:-2px;margin-bottom:24px}
    .hero h1 .accent{color:var(--accent)}
    .hero p{font-size:18px;color:var(--text-muted);max-width:600px;margin:0 auto 40px;line-height:1.7}
    .hero-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
    .btn{display:inline-block;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;cursor:pointer;border:none;transition:all 0.2s}
    .btn-primary{background:var(--accent);color:#0f0f0f}.btn-primary:hover{background:#d4b45a;text-decoration:none}
    .btn-secondary{background:transparent;color:var(--text);border:1px solid var(--border)}.btn-secondary:hover{background:var(--bg2);text-decoration:none}
    .trust-badges{display:flex;gap:24px;justify-content:center;margin-top:48px;flex-wrap:wrap}
    .badge{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-muted)}
    .badge-icon{width:20px;height:20px;background:var(--bg3);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px}
    .verified-section{padding:80px 0;background:var(--bg2)}
    .verified-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
    .verified-content h2{font-size:32px;font-weight:700;letter-spacing:-1px;margin-bottom:20px}
    .verified-content p{color:var(--text-muted);font-size:16px;margin-bottom:24px}
    .verified-features{list-style:none}.verified-features li{padding:8px 0;font-size:15px;display:flex;gap:12px;align-items:flex-start}
    .verified-features li::before{content:'✓';color:var(--accent);font-weight:700;flex-shrink:0}
    .verified-image{background:linear-gradient(135deg,#1a1a1a,#252525);border-radius:16px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-muted);border:1px solid var(--border);overflow:hidden;position:relative}
    .verified-image img{width:100%;height:100%;object-fit:cover;opacity:0.8}
    .verified-image-overlay{position:absolute;bottom:16px;left:16px;right:16px;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);padding:12px 16px;border-radius:8px;font-size:12px}
    .verified-image-overlay span{color:var(--green)}
    .pricing{padding:80px 0}
    .section-label{font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:16px;text-align:center}
    .section-title{font-size:36px;font-weight:700;letter-spacing:-1px;text-align:center;margin-bottom:12px}
    .section-subtitle{font-size:16px;color:var(--text-muted);text-align:center;max-width:500px;margin:0 auto 48px}
    .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
    .plan{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:32px 28px;display:flex;flex-direction:column}
    .plan-popular{border-color:var(--accent);position:relative}
    .plan-popular::before{content:'Most Popular';position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--accent);color:#0f0f0f;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.5px}
    .plan-name{font-size:18px;font-weight:600;margin-bottom:8px}
    .plan-desc{font-size:14px;color:var(--text-muted);margin-bottom:24px;min-height:40px}
    .plan-price{display:flex;align-items:baseline;gap:6px;margin-bottom:4px}.plan-price .amount{font-size:40px;font-weight:700}.plan-price .period{font-size:14px;color:var(--text-muted)}
    .plan-regular{font-size:12px;color:var(--text-muted);text-decoration:line-through;margin-bottom:24px}
    .plan-features{list-style:none;margin-bottom:32px;flex-grow:1}.plan-features li{padding:6px 0;font-size:14px;color:var(--text-muted);display:flex;gap:8px}.plan-features li strong{color:var(--text)}
    .plan-cta{margin-top:auto}.plan-cta .btn{width:100%;text-align:center;padding:12px;font-size:14px}
    .usecases{padding:80px 0;background:var(--bg2)}
    .usecases-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
    .usecase{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:28px 24px}
    .usecase-icon{width:40px;height:40px;background:var(--bg3);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:18px}
    .usecase h3{font-size:16px;font-weight:600;margin-bottom:8px}.usecase p{font-size:14px;color:var(--text-muted);line-height:1.6}
    .usecase-plans{display:flex;gap:8px;margin-top:16px}
    .usecase-badge{font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;background:var(--bg3);color:var(--text-muted)}
    .cost-section{padding:80px 0}
    .cost-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}
    .cost-card{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:32px}
    .cost-card h3{font-size:18px;font-weight:600;margin-bottom:24px}
    .cost-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);font-size:14px}
    .cost-row:last-child{border-bottom:none}.cost-row .label{color:var(--text-muted)}.cost-row .api-col{color:var(--green);font-weight:500}.cost-row .stock-col{color:var(--text-muted)}
    .cost-summary{margin-top:24px;padding:16px;background:var(--bg3);border-radius:8px;font-size:14px;color:var(--text-muted);line-height:1.7}
    .api-examples{padding:80px 0;background:var(--bg2)}
    .examples-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:48px}
    .example-card{background:var(--bg);border:1px solid var(--border);border-radius:12px;overflow:hidden}
    .example-header{padding:14px 20px;background:var(--bg3);font-size:13px;font-family:'Courier New',monospace;color:var(--accent);border-bottom:1px solid var(--border)}
    .example-body{padding:20px}.example-code{font-family:'Courier New',monospace;font-size:13px;color:var(--text-muted);white-space:pre;line-height:1.6;overflow-x:auto}
    .example-desc{margin-top:12px;font-size:13px;color:var(--text-muted)}
    .faq{padding:80px 0}.faq-list{max-width:640px;margin:48px auto 0}
    .faq-item{border-bottom:1px solid var(--border);padding:20px 0}.faq-q{font-weight:600;font-size:15px;margin-bottom:8px}.faq-a{font-size:14px;color:var(--text-muted);line-height:1.7}
    .cta-section{padding:96px 0;text-align:center;background:linear-gradient(to bottom,var(--bg),var(--bg2))}
    .cta-section h2{font-size:36px;font-weight:700;letter-spacing:-1px;margin-bottom:16px}
    .cta-section p{font-size:16px;color:var(--text-muted);margin-bottom:32px}
    .waitlist-form{max-width:480px;margin:0 auto;background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:32px}
    .form-group{margin-bottom:16px}.form-group label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--text-muted)}
    .form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:14px}
    .form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:var(--accent)}
    .form-group textarea{resize:vertical;min-height:80px}
    .form-success{padding:16px;background:rgba(74,222,128,0.1);border:1px solid var(--green);border-radius:8px;font-size:14px;color:var(--green);display:none}
    footer{padding:40px 0;border-top:1px solid var(--border);text-align:center;font-size:13px;color:var(--text-muted)}
    @media(max-width:768px){.plans,.verified-grid,.cost-grid,.examples-grid,.usecases-grid{grid-template-columns:1fr}.nav-links{display:none}}
  </style>
</head>
<body>
  <nav>
    <div class="container">
      <a href="/" class="logo">Wild<span>Photography</span></a>
      <div class="nav-links">
        <a href="/galleries">Galleries</a>
        <a href="/species">Species</a>
        <a href="/location">Locations</a>
        <a href="/account/api">Dashboard</a>
      </div>
    </div>
  </nav>

  <section class="hero">
    <div class="container">
      <h1>Programmatic Access to<br><span class="accent">Verified Costa Rica Wildlife</span></h1>
      <p>Access 40,000+ real wildlife and travel photos through a developer-friendly API. Built for automated content workflows, AI agents, and tourism platforms.</p>
      <div class="hero-actions">
        <a href="#waitlist" class="btn btn-primary">Apply for Early Access</a>
        <a href="#examples" class="btn btn-secondary">View API Examples</a>
      </div>
      <div class="trust-badges">
        <div class="badge"><div class="badge-icon">✓</div> 40,000+ photos</div>
        <div class="badge"><div class="badge-icon">✓</div> Real Costa Rica</div>
        <div class="badge"><div class="badge-icon">✓</div> Commercial-ready</div>
        <div class="badge"><div class="badge-icon">✓</div> Keywords included</div>
        <div class="badge"><div class="badge-icon">✓</div> Geo-tagged</div>
      </div>
    </div>
  </section>

  <section class="verified-section">
    <div class="container">
      <div class="verified-grid">
        <div class="verified-content">
          <h2>Not Stock. Verified Real Photography.</h2>
          <p>Traditional stock sites are designed for manual search and per-image licensing. WildPhotography API is built for programmatic content production — with every image verified, keyword-enriched, and geo-tagged.</p>
          <ul class="verified-features">
            <li><strong>Photographer-verified</strong> — Every photo taken by Joshua ten Brink in Costa Rica since 2018</li>
            <li><strong>Species-accurate</strong> — Common name, scientific name, family classification</li>
            <li><strong>Location-verified</strong> — Actual GPS coordinates, region, destination context</li>
            <li><strong>Content-ready</strong> — Keywords, alt-text suggestions, article prompts included</li>
            <li><strong>Derivative-only access</strong> — Originals never exposed; safe licensing built in</li>
            <li><strong>Search-ready</strong> — Typesense-powered instant search across all fields</li>
          </ul>
        </div>
        <div class="verified-image">
          <img src="https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev/derivatives/thumbs/img-9761-jpg-McvJMD_thumb.jpg" alt="Scarlet macaw in Costa Rica" onerror="this.parentElement.innerHTML='<div style=padding:24px;text-align:center>Scarlet Macaw · Costa Rica<br><small style=color:#4ade80>✓ Verified real photography</small></div>'">
          <div class="verified-image-overlay"><span>✓ Verified</span> Scarlet macaw · Osa Peninsula · GPS: 8.54°N, 83.3°W</div>
        </div>
      </div>
    </div>
  </section>

  <section class="pricing" id="pricing">
    <div class="container">
      <div class="section-label">Pricing</div>
      <h2 class="section-title">Simple, Predictable API Pricing</h2>
      <p class="section-subtitle">No per-image fees. No download charges. Just monthly API calls and the derivatives you need.</p>
      <div class="plans">
        <div class="plan">
          <div class="plan-name">Explorer Developer</div>
          <div class="plan-desc">For bloggers, indie developers, and startup MVPs building Costa Rica content pages.</div>
          <div class="plan-price"><span class="amount">$24</span><span class="period">/mo</span></div>
          <div class="plan-regular">$49/month regular price</div>
          <ul class="plan-features">
            <li><strong>250</strong> API calls/month</li>
            <li>Thumb + Small derivatives</li>
            <li>Attribution required</li>
            <li>Non-commercial use</li>
            <li>Content helper metadata</li>
            <li>Email support</li>
          </ul>
          <div class="plan-cta"><a href="#waitlist" class="btn btn-secondary">Apply for Explorer</a></div>
        </div>
        <div class="plan plan-popular">
          <div class="plan-name">Professional Tourism</div>
          <div class="plan-desc">For hotels, tour operators, tourism companies, and content automation systems.</div>
          <div class="plan-price"><span class="amount">$99</span><span class="period">/mo</span></div>
          <div class="plan-regular">$199/month regular price</div>
          <ul class="plan-features">
            <li><strong>750</strong> API calls/month</li>
            <li>Thumb + Small + Medium derivatives</li>
            <li>Commercial use allowed</li>
            <li>No attribution required</li>
            <li>Content helper metadata</li>
            <li>Priority support</li>
          </ul>
          <div class="plan-cta"><a href="#waitlist" class="btn btn-primary">Apply for Professional</a></div>
        </div>
        <div class="plan">
          <div class="plan-name">AI & Enterprise Vision</div>
          <div class="plan-desc">For AI travel agents, LLM content systems, tourism boards, and enterprise automation.</div>
          <div class="plan-price"><span class="amount">$499</span><span class="period">/mo</span></div>
          <div class="plan-regular">$999/month regular price</div>
          <ul class="plan-features">
            <li><strong>2,000</strong> API calls/month</li>
            <li>All derivatives (thumb to large)</li>
            <li>Commercial + AI agent use</li>
            <li>Enterprise licensing terms</li>
            <li>Content helper + SEO prompts</li>
            <li>Dedicated support</li>
          </ul>
          <div class="plan-cta"><a href="#waitlist" class="btn btn-secondary">Apply for Enterprise</a></div>
        </div>
      </div>
    </div>
  </section>

  <section class="usecases">
    <div class="container">
      <div class="section-label">Use Cases</div>
      <h2 class="section-title">Built for Programmatic Content Production</h2>
      <p class="section-subtitle">From travel blogs to AI agents — WildPhotography API powers automated wildlife content workflows.</p>
      <div class="usecases-grid">
        <div class="usecase"><div class="usecase-icon">🖥️</div><h3>Travel Content Pages</h3><p>Automatically populate destination pages with real wildlife photos from Costa Rica. Search by location and get keyword-enriched images ready to publish.</p><div class="usecases-plans"><span class="usecase-badge">Explorer</span><span class="usecase-badge">Professional</span><span class="usecase-badge">Enterprise</span></div></div>
        <div class="usecase"><div class="usecase-icon">🤖</div><h3>AI Travel Agents</h3><p>Give your AI agent access to verified Costa Rica wildlife photos. Include real imagery in generated travel recommendations and itineraries.</p><div class="usecases-plans"><span class="usecase-badge">Enterprise</span></div></div>
        <div class="usecase"><div class="usecase-icon">🏨</div><h3>Hotel & Tourism Sites</h3><p>Populate your hotel website with local wildlife photography. Show guests what wildlife they might see during their stay — automatically.</p><div class="usecases-plans"><span class="usecase-badge">Professional</span><span class="usecase-badge">Enterprise</span></div></div>
        <div class="usecase"><div class="usecase-icon">📝</div><h3>Wildlife Education</h3><p>Build species guides with real photography. Get common name, scientific name, behavior notes, and suggested article content in every response.</p><div class="usecases-plans"><span class="usecase-badge">Explorer</span><span class="usecase-badge">Professional</span></div></div>
        <div class="usecase"><div class="usecase-icon">🗺️</div><h3>Destination Portals</h3><p>Power destination pages with geo-tagged wildlife photos. Show photos near specific coordinates for travel planning features.</p><div class="usecases-plans"><span class="usecase-badge">Professional</span><span class="usecase-badge">Enterprise</span></div></div>
        <div class="usecase"><div class="usecase-icon">📊</div><h3>SEO Content Systems</h3><p>Generate location-based wildlife content automatically. Each photo includes SEO keywords, alt-text suggestions, and article prompt seeds.</p><div class="usecases-plans"><span class="usecase-badge">Enterprise</span></div></div>
      </div>
    </div>
  </section>

  <section class="cost-section">
    <div class="container">
      <div class="section-label">Cost Comparison</div>
      <h2 class="section-title">A More Efficient Alternative to Traditional Stock Photography</h2>
      <p class="section-subtitle">Traditional stock sites are designed for manual image search and individual licensing. WildPhotography API is built for automated, agentic content workflows.</p>
      <div class="cost-grid">
        <div class="cost-card">
          <h3>WildPhotography API</h3>
          <div class="cost-row"><span class="label">Monthly cost (Professional)</span><span class="api-col">$99/month</span></div>
          <div class="cost-row"><span class="label">API calls included</span><span class="api-col">750 calls/month</span></div>
          <div class="cost-row"><span class="label">Images per call</span><span class="api-col">Up to 50 per request</span></div>
          <div class="cost-row"><span class="label">Images per month (est.)</span><span class="api-col">~15,000+ images</span></div>
          <div class="cost-row"><span class="label">Keywords per image</span><span class="api-col">Included</span></div>
          <div class="cost-row"><span class="label">Alt-text suggestions</span><span class="api-col">Included</span></div>
          <div class="cost-row"><span class="label">Content prompt seeds</span><span class="api-col">Included</span></div>
          <div class="cost-summary">Predictable monthly pricing reduces manual image sourcing overhead. Automated discovery via API calls means content teams spend less time searching and more time publishing.</div>
        </div>
        <div class="cost-card">
          <h3>Traditional Stock Photography</h3>
          <div class="cost-row"><span class="label">Typical per-image cost</span><span class="stock-col">$5–$25/image</span></div>
          <div class="cost-row"><span class="label">10 images/month cost</span><span class="stock-col">$50–$250</span></div>
          <div class="cost-row"><span class="label">Search time per image</span><span class="stock-col">10–30 minutes</span></div>
          <div class="cost-row"><span class="label">Keyword enrichment</span><span class="stock-col">Manual add-on</span></div>
          <div class="cost-row"><span class="label">Alt-text generation</span><span class="stock-col">Manual effort</span></div>
          <div class="cost-row"><span class="label">Content prompt seeds</span><span class="stock-col">Not available</span></div>
          <div class="cost-row"><span class="label">AI agent compatibility</span><span class="stock-col">Manual workflow</span></div>
          <div class="cost-summary">Traditional stock requires repetitive per-image search, selection, licensing, and download workflows. For automated content production, this per-image cost model can be significantly more expensive than API-based access.</div>
        </div>
      </div>
    </div>
  </section>

  <section class="api-examples" id="examples">
    <div class="container">
      <div class="section-label">API Examples</div>
      <h2 class="section-title">Developer-Friendly Endpoints</h2>
      <p class="section-subtitle">All endpoints return JSON with derivative URLs, species data, location context, and content helper metadata.</p>
      <div class="examples-grid">
        <div class="example-card">
          <div class="example-header">GET /api/v1/search?q=sloth&location=manuel+antonio&limit=5</div>
          <div class="example-body">
            <div class="example-code">{
  "results": [{
    "id": 12345,
    "slug": "two-toed-sloth-manuel-antonio",
    "title": "Two-toed Sloth in Manuel Antonio",
    "species": "Two-toed Sloth",
    "scientific_name": "Choloepus hoffmanni",
    "location_name": "Manuel Antonio",
    "thumb_url": "https://media.wildphotography.com/...",
    "small_url": "https://media.wildphotography.com/...",
    "content_helper": {
      "keywords": ["sloth", "Costa Rica", "Manuel Antonio"],
      "suggested_alt_text": "Two-toed sloth in Manuel Antonio",
      "article_prompt_seed": "Write a travel article about..."
    }
  }],
  "pagination": { "total": 47, "has_more": true }
}</div>
            <div class="example-desc">Search photos by keyword, species, location, or any combination.</div>
          </div>
        </div>
        <div class="example-card">
          <div class="example-header">GET /api/v1/species/scarlet-macaw</div>
          <div class="example-body">
            <div class="example-code">{
  "species": {
    "common_name": "Scarlet Macaw",
    "scientific_name": "Ara macao",
    "species_type": "bird",
    "family_name": "Psittacidae"
  },
  "photos": [...],
  "related_species": [{ "slug": "great-green-macaw", ... }],
  "content_helper": {
    "article_prompt_seed": "Write a wildlife guide...",
    "seo_topics": ["Birdwatching in Costa Rica"]
  }
}</div>
            <div class="example-desc">Get species info, all photos of that species, and related species.</div>
          </div>
        </div>
        <div class="example-card">
          <div class="example-header">GET /api/v1/locations/monteverde</div>
          <div class="example-body">
            <div class="example-code">{
  "location": {
    "name": "Monteverde Cloud Forest",
    "slug": "monteverde",
    "region": "Puntarenas",
    "latitude": 10.3021,
    "longitude": -84.8163
  },
  "photos": [...],
  "gallery_suggestions": [{ "slug": "monteverde-birds", "photo_count": 156 }]
}</div>
            <div class="example-desc">Get location metadata with GPS coordinates, wildlife found there, and gallery suggestions.</div>
          </div>
        </div>
        <div class="example-card">
          <div class="example-header">GET /api/v1/random?location=tamarindo&count=5</div>
          <div class="example-body">
            <div class="example-code">{
  "photos": [{
    "id": 12891,
    "slug": "howler-monkey-tamarindo-beach",
    "title": "Howler Monkey at Tamarindo Beach",
    "species": "Mantled Howler Monkey",
    "location_name": "Tamarindo",
    "thumb_url": "...",
    "small_url": "...",
    "content_helper": {
      "social_caption_seed": "Mantled howler monkey spotted...",
      "suggested_caption": "Mantled Howler Monkey photographed in Tamarindo..."
    }
  }],
  "count": 5
}</div>
            <div class="example-desc">Get random photos filtered by location, species, or category for content variety.</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="faq">
    <div class="container">
      <div class="section-label">FAQ</div>
      <h2 class="section-title">Questions & Answers</h2>
      <div class="faq-list">
        <div class="faq-item"><div class="faq-q">What's included in each API response?</div><div class="faq-a">Every photo response includes: ID, slug, title, description, species common name, scientific name, location, region, country, gallery info, GPS coordinates (if public-safe), and derivative URLs allowed by your plan. Each response also includes a content_helper object with keywords, suggested alt text, caption, SEO topics, and article prompt seeds.</div></div>
        <div class="faq-item"><div class="faq-q">Can I access original high-resolution images?</div><div class="faq-a">No. The API only exposes derivative URLs (thumb, small, medium, large). Original R2 keys and bucket paths are never exposed. This protects the photographer's work while still providing high-quality, usable images for your content needs.</div></div>
        <div class="faq-item"><div class="faq-q">What makes WildPhotography different from stock sites?</div><div class="faq-a">Traditional stock sites are designed for manual image search. WildPhotography API is designed for automated, programmatic content workflows. Every image is verified real photography, species-accurate, geo-tagged, and keyword-enriched. You get consistent, structured data with every photo — no manual enrichment required.</div></div>
        <div class="faq-item"><div class="faq-q">How does attribution work?</div><div class="faq-a">Explorer plans require attribution (e.g., "© Joshua ten Brink / WildPhotography.com"). Professional and Enterprise plans do not require attribution, though crediting the photographer is appreciated where practical.</div></div>
        <div class="faq-item"><div class="faq-q">What's the difference between API calls and image downloads?</div><div class="faq-a">One API call can return up to 100 photos (depending on your plan limit). So 250 API calls can return tens of thousands of images per month. You're not paying per image — you're paying for access to the platform.</div></div>
        <div class="faq-item"><div class="faq-q">Is there a free trial?</div><div class="faq-a">Early access users may receive a limited free period. Apply through the waitlist form to express interest and discuss your use case.</div></div>
      </div>
    </div>
  </section>

  <section class="cta-section" id="waitlist">
    <div class="container">
      <h2>Ready to Build with Real Costa Rica Wildlife?</h2>
      <p>Apply for early access and we'll be in touch shortly.</p>
      <div class="waitlist-form">
        <form id="waitlistForm">
          <div class="form-group"><label for="name">Name</label><input type="text" id="name" name="name" placeholder="Your name"></div>
          <div class="form-group"><label for="email">Email *</label><input type="email" id="email" name="email" placeholder="you@company.com" required></div>
          <div class="form-group"><label for="company">Company</label><input type="text" id="company" name="company" placeholder="Your company"></div>
          <div class="form-group"><label for="intended_use">Intended Use</label><input type="text" id="intended_use" name="intended_use" placeholder="e.g., AI travel agent, hotel website, SEO content system"></div>
          <div class="form-group"><label for="selected_plan">Plan Interest</label><select id="selected_plan" name="selected_plan"><option value="">Select a plan</option><option value="explorer">Explorer Developer ($24/mo launch)</option><option value="professional">Professional Tourism ($99/mo launch)</option><option value="enterprise">AI & Enterprise Vision ($499/mo launch)</option></select></div>
          <div class="form-group"><label for="message">Message</label><textarea id="message" name="message" placeholder="Tell us about your project..."></textarea></div>
          <button type="submit" class="btn btn-primary" style="width:100%">Apply for Early Access</button>
        </form>
        <div class="form-success" id="formSuccess">Thank you! We've received your application and will be in touch shortly.</div>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <p>© 2026 Joshua ten Brink / WildPhotography.com · <a href="/">Home</a> · <a href="/galleries">Galleries</a> · <a href="/api-access">API Access</a></p>
    </div>
  </footer>

  <script>
    document.getElementById('waitlistForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        name: form.name.value,
        email: form.email.value,
        company: form.company.value,
        intended_use: form.intended_use.value,
        selected_plan: form.selected_plan.value,
        message: form.message.value
      };
      try {
        const res = await fetch('/api/v1/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          form.style.display = 'none';
          document.getElementById('formSuccess').style.display = 'block';
        } else {
          alert('Something went wrong. Please try again.');
        }
      } catch (err) {
        alert('Something went wrong. Please try again.');
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' }
  });
}
