#!/usr/bin/env node
/**
 * discover-photo-usage-credits.js
 *
 * Usage:
 *   node scripts/discover-photo-usage-credits.js --mode=historical --maxResults=500
 *   node scripts/discover-photo-usage-credits.js --mode=recent --maxResults=50
 *
 * Env:
 *   DATABASE_URL  — Neon connection string
 *   SERPSTAT_API_KEY or SEO_SERPSTAT_TOKEN — optional Serpstat API key
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Config ───────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

// Expanded credit phrases — now accepts stock-photography credit formats
const CREDIT_PHRASES = [
  'Joshua ten Brink',
  'Joshua Ten Brink',
  'Photo by Joshua ten Brink',
  'Photos by Joshua ten Brink',
  'Photography by Joshua ten Brink',
  'Joshua ten Brink/Shutterstock',
  'Shutterstock/Joshua ten Brink',
  'Joshua ten Brink / Shutterstock',
  '© Joshua ten Brink',
  '© Joshua ten Brink / Shutterstock',
  'Photo: Joshua ten Brink',
  'Photo: Joshua ten Brink/Shutterstock',
  'Credit: Joshua ten Brink',
  'Credit: Shutterstock/Joshua ten Brink',
  'Photos: Joshua ten Brink',
];

// Build a regex from all credit phrases
const CREDIT_RE = new RegExp(
  CREDIT_PHRASES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);

// Only exclude shutterstock.com itself — NOT third-party articles
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
  'pexels.com',
  'unsplash.com',
  'canva.com',
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

// Site name normalization
const BRAND_MAP = {
  'explore.com': 'Explore',
  'latinlawyer.com': 'Latin Lawyer',
  'matadornetwork.com': 'Matador Network',
  'islands.com': 'Islands',
  'easyviajar.com': 'EasyViajar',
  'nacion.com': 'La Nación',
  'teletica.com': 'Teletica',
  'lonelyplanet.com': 'Lonely Planet',
  'msn.com': 'MSN',
  'forbes.com': 'Forbes',
  'cnn.com': 'CNN',
  'travelandleisure.com': 'Travel + Leisure',
  'tripadvisor.com': 'TripAdvisor',
  'aol.com': 'AOL',
  'theculturetrip.com': 'Culture Trip',
  'wetu.com': 'Wetu',
  'semana.com': 'Semana',
  'nypost.com': 'New York Post',
  'usatoday.com': 'USA Today',
  'washingtonpost.com': 'Washington Post',
  'theguardian.com': 'The Guardian',
  'bbc.com': 'BBC',
  'bbc.co.uk': 'BBC',
};

const QUERY_VARIANTS = [
  '"Joshua ten Brink" photography',
  '"Joshua ten Brink" photo',
  '"Joshua ten Brink" photographer',
  '"Photo by Joshua ten Brink"',
  '"Photos by Joshua ten Brink"',
  '"Joshua ten Brink" "Costa Rica"',
  '"Joshua ten Brink/Shutterstock"',
  '"Shutterstock/Joshua ten Brink"',
  '"Joshua ten Brink" "Shutterstock"',
  '"Joshua ten Brink" "Costa Rica" "Shutterstock"',
  '"Photo: Joshua ten Brink/Shutterstock"',
  '"Credit: Shutterstock/Joshua ten Brink"',
  '"© Joshua ten Brink / Shutterstock"',
  '"Joshua ten Brink" wildlife photography Costa Rica',
  '"Joshua ten Brink" bird photography Costa Rica',
  '"Joshua ten Brink" travel photography',
];

// ─── Helpers ────────────────────────────────────────────────────────────
function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
     'fbclid','gclid','msclkid','_ga','ref','source','partner'].forEach(p => u.searchParams.delete(p));
    u.hash = '';
    return u.toString().replace(/\?$/, '');
  } catch { return raw; }
}

function normalizeSiteName(domain) {
  if (BRAND_MAP[domain]) return BRAND_MAP[domain];
  return domain.replace(/^www\./,'').replace(/\.[a-z]{2,}$/,'').split(/[-_]/).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
}

async function fetchText(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const proto = u.protocol === 'https:' ? https : http;
      const req = proto.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
    } catch (e) { reject(e); }
  });
}

async function verifyPage(url) {
  try {
    const text = await fetchText(url, 15000);
    const match = CREDIT_RE.exec(text);
    if (match) {
      const idx = Math.max(0, match.index - 150);
      return { verified: true, matchedPhrase: match[0], excerpt: text.slice(idx, idx + 300) };
    }
    return { verified: false };
  } catch (e) {
    return { verified: false, error: e.message };
  }
}

async function searchGoogle(query) {
  // Try Serpstat API
  const apiKey = process.env.SERPSTAT_API_KEY || process.env.SEO_SERPSTAT_TOKEN;
  if (apiKey) {
    try {
      const resp = await fetch(
        `https://api.serpstat.com/v4/serpstatapi.json?token=${apiKey}&query=${encodeURIComponent(query)}&se=googleorganic&limit=50`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        return (data.results || []).map(r => r.url || r.original_url).filter(Boolean);
      }
    } catch (e) {
      console.log('  Serpstat failed:', e.message.slice(0, 80));
    }
  }

  // Fallback: Bing organic search via API
  const bingKey = process.env.BING_API_KEY;
  if (bingKey) {
    try {
      const resp = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=50&safesearch=Off`,
        { headers: { 'Ocp-Apim-Subscription-Key': bingKey }, signal: AbortSignal.timeout(12000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        return (data.webPages?.value || []).map(r => r.url);
      }
    } catch (e) {
      console.log('  Bing API failed:', e.message.slice(0, 80));
    }
  }

  // Fallback: DuckDuckGo with proper cookies
  try {
    // Use the lite HTML version
    const searchUrl = `https://lite.duckduckgo.com/50x/?q=${encodeURIComponent(query)}&kl=us-en`;
    const text = await fetchText(searchUrl, 12000);
    const urls = [];
    const seen = new Set();
    const matches = text.match(/href="(https?:\/\/(?!duckduckgo|privacy|help\.duckduckgo)[^"]+)"/g) || [];
    for (const m of matches) {
      try {
        const raw = m.slice(6, -1);
        const u = new URL(raw);
        const h = u.hostname.replace(/^www\./, '');
        if (!EXCLUDED_DOMAINS.has(h) && !seen.has(raw)) {
          seen.add(raw);
          urls.push(raw);
        }
      } catch {}
    }
    return urls;
  } catch (e) {
    console.log('  DuckDuckGo lite failed:', e.message.slice(0, 100));
    return [];
  }
}

function extractTitle(text, fallbackUrl) {
  const m = text.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) {
    return m[1].trim().replace(/\s*[-|–—]\s*.+$/, '').replace(/\s+/g, ' ').trim();
  }
  return fallbackUrl;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode=recent') ? 'recent' : 'historical';
  const max = parseInt(args.find(a => a.startsWith('--maxResults='))?.split('=')[1] || '300');
  return { mode, maxResults: max };
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
  await p.query(`
    INSERT INTO photo_usage_credits (source_url, canonical_url, domain, site_name, article_title, detected_credit_text, matched_phrase, excerpt, google_query, status, published, first_found_at, last_checked_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'verified',true,now(),now())
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
  `, [
    credit.source_url,
    credit.canonical_url || credit.source_url,
    credit.domain,
    credit.site_name,
    credit.article_title,
    credit.excerpt || null,
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
  console.log(`\n=== Photo Credit Discovery (${mode} mode, max=${maxResults}) ===\n`);

  const existingUrls = await getExistingUrls();
  const queries = mode === 'recent' ? QUERY_VARIANTS.slice(0, 5) : QUERY_VARIANTS;

  let urlsDiscovered = 0, dupesSkipped = 0, blocked = 0, rejected = 0, verifiedAdded = 0, errors = 0;
  const seen = new Set();

  for (const query of queries) {
    console.log(`\nSearching: ${query}`);
    let results;
    try {
      results = await searchGoogle(query);
    } catch (e) {
      console.log('  Search error:', e.message.slice(0, 80));
      continue;
    }
    console.log(`  Found ${results.length} raw URLs`);

    for (const raw of results) {
      if (urlsDiscovered >= maxResults) break;
      const url = normalizeUrl(raw);
      urlsDiscovered++;
      if (seen.has(url)) { dupesSkipped++; continue; }
      seen.add(url);
      if (existingUrls.has(url)) { dupesSkipped++; continue; }

      const hostname = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
      if (EXCLUDED_DOMAINS.has(hostname)) { blocked++; continue; }

      process.stdout.write(`  Verifying (${hostname}): ${url.slice(0, 55)}... `);
      const result = await verifyPage(url);

      if (result.verified) {
        const pageText = result.excerpt || '';
        const articleTitle = extractTitle(pageText || url, url);
        const credit = {
          source_url: url,
          canonical_url: url,
          domain: hostname,
          site_name: normalizeSiteName(hostname),
          article_title: articleTitle,
          matched_phrase: result.matchedPhrase,
          excerpt: pageText.slice(0, 300),
          google_query: query,
        };
        await upsertCredit(credit);
        existingUrls.add(url);
        verifiedAdded++;
        console.log(`VERIFY (${result.matchedPhrase})`);
      } else {
        rejected++;
        console.log(`skip${result.error ? ' ['+result.error+']' : ''}`);
      }
    }
    if (urlsDiscovered >= maxResults) break;
  }

  const total = await getTotalCount();
  console.log(`\n=== Results ===`);
  console.log(`Queries executed:        ${queries.length}`);
  console.log(`URLs discovered:          ${urlsDiscovered}`);
  console.log(`Duplicates skipped:       ${dupesSkipped}`);
  console.log(`Verified inserted:        ${verifiedAdded}`);
  console.log(`Blocked (excluded doms):  ${blocked}`);
  console.log(`Rejected (no credit):     ${rejected}`);
  console.log(`Total verified in DB:     ${total}`);
  console.log(`Public page:              https://wildphotography.com/photography-featured`);
  await closePool();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
