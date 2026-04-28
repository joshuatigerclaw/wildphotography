#!/usr/bin/env node
/**
 * discover-photo-usage-credits.js
 * 
 * Usage:
 *   node scripts/discover-photo-usage-credits.js --mode=historical --maxResults=500
 *   node scripts/discover-photo-usage-credits.js --mode=recent --maxResults=50
 * 
 * Requires env:
 *   DATABASE_URL - Neon connection string
 *   SERPSTAT_API_KEY - optional, for Serpstat API access
 *   SEO_SERPSTAT_TOKEN - optional alternate key
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Config ───────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const BRAND_MAP = {
  'nacion.com': 'La Nación',
  'teletica.com': 'Teletica',
  'lonelyplanet.com': 'Lonely Planet',
  'msn.com': 'MSN',
  'forbes.com': 'Forbes',
  'cnn.com': 'CNN',
  'travelandleisure.com': 'Travel + Leisure',
  'tripadvisor.com': 'TripAdvisor',
  'nacion.com': 'La Nación',
  'semana.com': 'Semana',
  'elplaced.com': 'El Placed',
  'costarricavibes.com': 'Costa Rica Vibes',
};

const EXCLUDED_DOMAINS = new Set([
  'shutterstock.com',
  'gettyimages.com',
  'alamy.com',
  'dreamstime.com',
  'istockphoto.com',
  '123rf.com',
  'depositphotos.com',
  'freepik.com',
  'canstockphoto.com',
  'photoresizer.com',
  'canva.com',
  'pexels.com',
  'unsplash.com',
  'pexels.com',
  'pinterest.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'login.live.com',
  'accounts.google.com',
  'support.google.com',
  'web.archive.org',
  'archive.org',
  'webcache.googleusercontent.com',
  'translate.google.com',
  'maps.google.com',
  'duckduckgo.com',
  'bing.com',
  'search.yahoo.com',
]);

const CREDIT_PHRASES = [
  'Joshua ten Brink',
  'Joshua Ten Brink',
  'Photo by Joshua ten Brink',
  'Photos by Joshua ten Brink',
  'Photography by Joshua ten Brink',
  'Photos by Joshua ten Brink.',
  'Photo: Joshua ten Brink',
  '© Joshua ten Brink',
];

const QUERY_VARIANTS = [
  '"Joshua ten Brink" photography',
  '"Joshua ten Brink" photo',
  '"Joshua ten Brink" photographer',
  '"Photo by Joshua ten Brink"',
  '"Photos by Joshua ten Brink"',
  '"Joshua ten Brink" "Costa Rica"',
  '"Joshua ten Brink" -site:shutterstock.com -site:gettyimages.com -site:alamy.com',
  '"Joshua ten Brink" wildlife photography',
  '"Joshua ten Brink" Costa Rica wildlife',
  '"Joshua ten Brink" bird photography',
  '"Joshua ten Brink" travel photography',
];

const CREDIT_RE = new RegExp(
  CREDIT_PHRASES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);

// ─── Helpers ────────────────────────────────────────────────────────────
function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    // Remove tracking params
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('utm_term');
    u.searchParams.delete('utm_content');
    u.searchParams.delete('fbclid');
    u.searchParams.delete('gclid');
    u.searchParams.delete('msclkid');
    u.searchParams.delete('_ga');
    u.hash = '';
    return u.toString().replace(/\?$/, '');
  } catch {
    return raw;
  }
}

function normalizeSiteName(domain) {
  if (BRAND_MAP[domain]) return BRAND_MAP[domain];
  return domain
    .replace(/^www\./, '')
    .replace(/\.[a-z]{2,}$/, '')
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function fetchText(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const protocol = u.protocol === 'https:' ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PhotoCreditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode === 403 || res.statusCode === 429) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function verifyPage(url) {
  try {
    const text = await fetchText(url, 10000);
    for (const phrase of CREDIT_PHRASES) {
      if (text.includes(phrase)) {
        return { verified: true, matchedPhrase: phrase, text: text.slice(0, 3000) };
      }
    }
    return { verified: false };
  } catch (e) {
    return { verified: false, error: e.message };
  }
}

async function searchGoogle(query) {
  // Try Serpstat API first
  const apiKey = process.env.SERPSTAT_API_KEY || process.env.SEO_SERPSTAT_TOKEN;
  if (apiKey) {
    try {
      const params = new URLSearchParams({
        keyword: query,
        limit: '100',
        google_domain: 'google.com',
        se: 'googleorganic',
      });
      const url = `https://api.serpstat.com/v4/serpstatapi.json?token=${apiKey}&query=${encodeURIComponent(query)}&se=googleorganic&limit=50`;
      // Use the open query endpoint
      const resp = await fetch(`https://api.serpstat.com/v4/serpstatapi.json?token=${apiKey}&query=${encodeURIComponent(query)}&se=googleorganic&limit=50`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return (data.results || []).map(r => r.url || r.original_url).filter(Boolean);
      }
    } catch (e) {
      console.log('Serpstat API failed, falling back:', e.message.slice(0, 80));
    }
  }

  // Fallback: use a simple search via DuckDuckGo HTML
  try {
    const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    const text = await fetchText(ddgUrl, 8000);
    const urls = [];
    const matches = text.match(/href="(https?:\/\/(?!duckduckgo|privacy)[^"]+)"/g) || [];
    for (const m of matches) {
      try {
        const u = new URL(m.slice(6, -1));
        if (!EXCLUDED_DOMAINS.has(u.hostname.replace(/^www\./, ''))) {
          urls.push(u.toString());
        }
      } catch {}
    }
    return [...new Set(urls)];
  } catch (e) {
    console.log('DuckDuckGo fallback failed:', e.message.slice(0, 100));
    return [];
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode=recent') ? 'recent' : 'historical';
  const maxResults = parseInt(args.find(a => a.startsWith('--maxResults='))?.split('=')[1] || '200');
  return { mode, maxResults };
}

// ─── Database ────────────────────────────────────────────────────────────
const { Pool } = require('pg');
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL });
  return pool;
}

async function upsertCredit(credit) {
  const p = getPool();
  const q = `
    INSERT INTO photo_usage_credits (source_url, canonical_url, domain, site_name, article_title, detected_credit_text, matched_phrase, excerpt, google_query, status, published)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'verified',true)
    ON CONFLICT (source_url) DO UPDATE SET
      last_checked_at = now(),
      canonical_url = coalesce(nullif($2,''), canonical_url),
      domain = coalesce(nullif($3,''), domain),
      site_name = coalesce(nullif($4,''), site_name),
      article_title = coalesce(nullif($5,''), article_title),
      detected_credit_text = coalesce(nullif($6,''), detected_credit_text),
      matched_phrase = coalesce(nullif($7,''), matched_phrase),
      excerpt = coalesce(nullif($8,''), excerpt),
      google_query = coalesce(nullif($9,''), google_query)
    WHERE photo_usage_credits.status = 'verified'
  `;
  await p.query(q, [
    credit.source_url,
    credit.canonical_url || null,
    credit.domain,
    credit.site_name,
    credit.article_title,
    credit.detected_credit_text || null,
    credit.matched_phrase || null,
    credit.excerpt || null,
    credit.google_query || null,
  ]);
}

async function getExistingUrls() {
  const p = getPool();
  const r = await p.query('SELECT source_url FROM photo_usage_credits');
  return new Set(r.rows.map(row => normalizeUrl(row.source_url)));
}

async function getTotalCount() {
  const p = getPool();
  const r = await p.query("SELECT COUNT(*) FROM photo_usage_credits WHERE status = 'verified' AND published = true");
  return parseInt(r.rows[0].count);
}

async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const { mode, maxResults } = parseArgs();
  console.log(`\n=== Photo Credit Discovery (${mode} mode) ===\n`);

  const existingUrls = await getExistingUrls();
  const queries = mode === 'recent'
    ? QUERY_VARIANTS.slice(0, 5)
    : QUERY_VARIANTS;

  let urlsDiscovered = 0;
  let duplicatesSkipped = 0;
  let verifiedAdded = 0;
  let blocked = 0;
  let rejected = 0;

  for (const query of queries) {
    console.log(`\nSearching: ${query}`);
    const results = await searchGoogle(query);
    console.log(`  Found ${results.length} URLs`);

    for (const rawUrl of results.slice(0, mode === 'recent' ? 30 : 100)) {
      if (urlsDiscovered >= maxResults) break;

      const url = normalizeUrl(rawUrl);
      urlsDiscovered++;

      if (existingUrls.has(url)) {
        duplicatesSkipped++;
        continue;
      }

      const hostname = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
      if (EXCLUDED_DOMAINS.has(hostname)) {
        blocked++;
        continue;
      }

      console.log(`  Verifying: ${url}`);
      const result = await verifyPage(url);

      if (result.verified) {
        // Try to extract article title from page text
        let articleTitle = url;
        try {
          const titleMatch = result.text.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) articleTitle = titleMatch[1].trim().replace(/\s*[-|–]\s*.+$/, '').trim();
        } catch {}

        const credit = {
          source_url: url,
          canonical_url: url,
          domain: hostname,
          site_name: normalizeSiteName(hostname),
          article_title: articleTitle,
          detected_credit_text: result.text.slice(0, 500),
          matched_phrase: result.matchedPhrase,
          excerpt: result.text.slice(0, 500),
          google_query: query,
        };

        await upsertCredit(credit);
        existingUrls.add(url);
        verifiedAdded++;
        console.log(`  ✅ Verified (${result.matchedPhrase}): ${hostname}`);
      } else {
        rejected++;
      }
    }

    if (urlsDiscovered >= maxResults) break;
  }

  const total = await getTotalCount();
  console.log(`\n=== Results ===`);
  console.log(`Queries searched:    ${queries.length}`);
  console.log(`URLs discovered:    ${urlsDiscovered}`);
  console.log(`Duplicates skipped:  ${duplicatesSkipped}`);
  console.log(`Verified added:      ${verifiedAdded}`);
  console.log(`Blocked (excluded):  ${blocked}`);
  console.log(`Rejected (unverif): ${rejected}`);
  console.log(`Total verified DB:  ${total}`);
  console.log(`Public page URL:     https://wildphotography.com/photography-featured`);

  await closePool();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
