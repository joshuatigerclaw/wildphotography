/**
 * WildPhotography SEO Metadata Backfill Batch
 * 
 * Generates seo_title, meta_description, and alt_text_suggestion for photos
 * that are public-ready but missing seo_title in their metadata JSONB.
 * 
 * Run: node scripts/seo_backfill_batch.js
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────
const DATABASE_URL = 'postgresql://neondb_owner:npg_GonqSbJlRi71@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const LOG_FILE = '/Users/joshuatenbrink/.openclaw/workspace/wild_seo_backfill_log.txt';
const BATCH_SIZE = 200;
const PROGRESS_EVERY = 1000;
const MAX_TITLE_LENGTH = 65;

// ─── Template patterns to detect non-useful titles ──────────────────────────────
const TEMPLATE_PATTERNS = [
  // Strict: exact match generic words
  /^landscape$/i,
  /^aerial$/i,
  /^photo$/i,
  /^image$/i,
  /^picture$/i,
  /^nature$/i,
  // Camera file patterns
  /^IMG_\d+/i,
  /^DSC_\d+/i,
  /^DJI_\d+/i,
  /^P\d{4,}/i,
  /^IMG_\d+_\d+/i,
  /^DSCF\d+/i,
  /^R\d{4,}/i,
  /^FILE\d+/i,
  /^\d{5,}$/i,                     // pure numeric like "22826"
  /^\d+\s+\S+$/i,                 // numeric prefix with one word: "22826 stuff"
  // "Power-Of-Nature" style
  /^Power[\s\u002D\u2013\u2014][Oo][\s\u002D\u2013\u2014][Nn]ature/i,
  // WildPhotography suffix (should be removed before this check anyway)
  /\| WildPhotography$/i,
];

// ─── Database client ───────────────────────────────────────────────────────────
const sql = neon(DATABASE_URL);

// ─── Logging ──────────────────────────────────────────────────────────────────
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

// ─── Title Cleaning ────────────────────────────────────────────────────────────
function isTemplateTitle(title) {
  if (!title) return true;
  return TEMPLATE_PATTERNS.some(p => p.test(title.trim()));
}

function cleanTitle(title) {
  if (!title) return null;
  const t = title.trim();
  
  // Remove known suffixes
  let cleaned = t
    .replace(/\s*\|\s*WildPhotography\s*$/i, '')
    // Remove "— Favorites —" suffix
    .replace(/[\s]*[\u002D\u2013\u2014][\s]*[Ff]avorites[\s]*[\u002D\u2013\u2014].*$/i, '')
    // Remove trailing numeric camera IDs: — IMG_xxxx, — DSC_xxxx, — DJI_xxxx, — #xxxx, — Pxxxx, — Rxxxx
    .replace(/[\s]*[\u002D\u2013\u2014][\s]*(IMG[_\-]?\d+|DSC[_\-]?\d+|DJI[_\-]?\d+|P\d{4,}|R\d{4,}|FILE\d+|\d{4,})[\s]*$/i, '')
    // Remove trailing camera file IDs: CL0A3931, TORTUGA-27, etc. (with or without dash)
    .replace(/[\s]+[A-Z]{2,10}[-_][A-Z0-9]{2,10}[\s]*$/gi, '')
    .replace(/[\s]+[A-Z]{2,3}[0-9][A-Z0-9]{3,}[\s]*$/gi, '')
    // Remove trailing parenthetical camera notes: (IMG_xxxx) or (dji0976)
    .replace(/\s*\(\s*[^)]*\d{4,}[^)]*\)\s*$/i, '')
    // Remove "— VEGETATION / LANDSCAPE / NATURE" suffix
    .replace(/[\s]*[\u002D\u2013\u2014][\s]*(VEGETATION|LANDSCAPE|NATURE)[\s]*$/i, '')
    // Remove "— Costa Rica — ..." suffix (gallery prefix in title)
    .replace(/[\s]*[\u002D\u2013\u2014][\s]*Costa[\s]+Rica[\s]*[\u002D\u2013\u2014].*$/i, '')
    // Remove "Costa Rica —" prefix (country name used as gallery name in title)
    .replace(/^(Costa[\s]+Rica)[\s\u002D\u2013\u2014]+/i, '')
    // Remove generic "landscape —", "photo —" etc. at start if followed by a location descriptor
    .replace(/^(landscape|photo|image|picture)[\s\u002D\u2013\u2014]+/i, '')
    // Final strip of any remaining dash-hash patterns
    .replace(/[\s]*[\u002D\u2013\u2014][\s]*#[\d]+(\s*)$/gi, '$1')
    .trim();
  
  // If result is empty or too generic, reject
  if (!cleaned || cleaned.length < 3) return null;
  if (isTemplateTitle(cleaned)) return null;
  
  // Truncate if too long
  if (cleaned.length > MAX_TITLE_LENGTH - 10) {
    cleaned = cleaned.substring(0, MAX_TITLE_LENGTH - 10).trim();
  }
  
  return cleaned;
}

// ─── SEO Generation ───────────────────────────────────────────────────────────
function resolveLocation(photo) {
  const loc = photo.location || '';
  const region = photo.region || '';
  const country = photo.country || '';

  // Normalize: strip country suffix from location if present
  let normalizedLoc = loc;
  if (loc && country && loc.toLowerCase().endsWith(', ' + country.toLowerCase())) {
    normalizedLoc = loc.substring(0, loc.length - (country.length + 2)).trim();
  } else if (loc && country && loc.toLowerCase() === country.toLowerCase()) {
    normalizedLoc = '';
  }

  // Use normalized location, fall back to region, then country
  if (normalizedLoc) return normalizedLoc;
  if (region && region.toLowerCase() !== country.toLowerCase()) return region;
  return country || 'Costa Rica';
}

function safeTruncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  const truncated = str.substring(0, maxLen);
  // Prefer word boundary (space) near end
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.7) return truncated.substring(0, lastSpace);
  // Otherwise try comma boundary
  const lastComma = truncated.lastIndexOf(',');
  if (lastComma > maxLen * 0.5) return truncated.substring(0, lastComma);
  // Fall back to any space
  if (lastSpace > 5) return truncated.substring(0, lastSpace);
  return truncated;
}

function generateSeoTitle(photo) {
  const resolvedLoc = resolveLocation(photo);
  // Only add country suffix if location doesn't already end with it
  const country = photo.country || 'Costa Rica';
  const suffix = resolvedLoc.toLowerCase().endsWith(country.toLowerCase())
    ? ''
    : ', ' + country;
  const maxLen = MAX_TITLE_LENGTH;

  // Priority 1: species_common_name
  if (photo.species_common_name && photo.species_common_name.trim()) {
    const species = photo.species_common_name.trim();
    const base = species + ' in ' + resolvedLoc + suffix;
    return safeTruncate(base, maxLen);
  }

  // Priority 2: cleaned title
  const cleaned = cleanTitle(photo.title);
  if (cleaned) {
    let subject = cleaned;
    const locLower = resolvedLoc.toLowerCase();
    const countryLower = country.toLowerCase();

    // Avoid title being same as location (duplication check)
    if (cleaned.toLowerCase() === locLower || cleaned.toLowerCase().includes(locLower + ' in')) {
      subject = 'Nature Photography';
    }
    // Avoid subject appearing as prefix of location (e.g. "Isla Tortuga" in "Isla Tortuga, Puntarenas")
    if (locLower && locLower.startsWith(cleaned.toLowerCase() + ', ')) {
      subject = 'Nature Photography';
    }
    // Avoid title containing location as suffix (e.g. "Rural Guanacaste" + "Guanacaste")
    if (locLower && subject.toLowerCase().endsWith(' ' + locLower)) {
      const stripped = subject.substring(0, subject.length - locLower.length).trim();
      if (stripped.length >= 3) subject = stripped;
    }
    // Avoid title ending with country name (duplicate with suffix)
    if (subject.toLowerCase().endsWith(', ' + countryLower) || subject.toLowerCase() === countryLower) {
      const stripped = subject.substring(0, subject.length - (countryLower.length + 2)).trim();
      if (stripped.length >= 3) subject = stripped;
    }
    // If subject contains country name in the middle (e.g. "Nauyaca Waterfalls - Puntarenas - Costa Rica")
    // it's a malformed title from import, fall back to Nature Photography
    if (subject.toLowerCase().includes(' - ' + countryLower) || subject.toLowerCase().includes(' — ' + countryLower)) {
      subject = 'Nature Photography';
    }
    // Avoid title starting with country name (duplicate with suffix)
    if (subject.toLowerCase().startsWith(countryLower + ' in ')) {
      const stripped = subject.substring(countryLower.length + 4).trim(); // +4 for " in "
      if (stripped.length >= 3) subject = stripped;
    }
    const base = subject + ' in ' + resolvedLoc + suffix;
    return safeTruncate(base, maxLen);
  }

  // Priority 3: location-based scene
  const base = 'Nature Photography in ' + resolvedLoc + suffix;
  return safeTruncate(base, maxLen);
}

function generateMetaDescription(photo) {
  const subject = photo.species_common_name?.trim()
    || cleanTitle(photo.title)
    || 'Wild Costa Rica wildlife and nature';
  
  const location = resolveLocation(photo);
  
  // Build 130-160 char description
  const base = `${subject} photograph from ${location}, Costa Rica. `;
  const context = 'Original wildlife and nature photography by WildPhotography — high-resolution images available.';
  
  let desc = base + context;
  if (desc.length > 160) {
    // Trim context
    const available = 160 - base.length;
    desc = base + context.substring(0, available - 3) + '...';
  }
  
  // Ensure minimum length
  if (desc.length < 130) {
    desc = `${subject} photograph from ${location}, Costa Rica, captured by WildPhotography. Original high-resolution wildlife and nature photography from Costa Rica.`;
  }
  
  // Final clamp
  if (desc.length > 160) {
    desc = desc.substring(0, 157) + '...';
  }
  
  return desc;
}

function generateAltText(photo) {
  const subject = photo.species_common_name?.trim()
    || cleanTitle(photo.title)
    || 'Costa Rica nature photography';
  
  const location = resolveLocation(photo);
  
  if (photo.species_common_name) {
    return `${subject} near ${location}, Costa Rica`;
  }
  
  return `${subject} in ${location}, Costa Rica`;
}

// ─── Stats tracking ───────────────────────────────────────────────────────────
let stats = {
  processed: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  startTime: Date.now(),
};

// ─── Main batch processor ──────────────────────────────────────────────────────
async function processBatch(offset) {
  // Fetch batch of photos missing seo_title
  const photos = await sql`
    SELECT 
      p.id,
      p.slug,
      p.title,
      p.location,
      p.region,
      p.country,
      p.species_common_name,
      p.metadata
    FROM photos p
    WHERE p.is_active = true
      AND p.ready_for_public_render = true
      AND p.search_ready = true
      AND (p.metadata IS NULL OR p.metadata::jsonb->>'seo_title' IS NULL OR p.metadata::jsonb->>'seo_title' = '')
    ORDER BY p.id ASC
    LIMIT ${BATCH_SIZE}
    OFFSET ${offset}
  `;
  
  if (!photos || photos.length === 0) {
    return { done: true, count: 0 };
  }
  
  const results = [];
  
  for (const row of photos) {
    const photo = {
      id: row.id,
      slug: row.slug,
      title: row.title || '',
      location: row.location || '',
      region: row.region || '',
      country: row.country || '',
      species_common_name: row.species_common_name || null,
      metadata: row.metadata || {},
    };
    
    try {
      const seoTitle = generateSeoTitle(photo);
      const metaDesc = generateMetaDescription(photo);
      const altText = generateAltText(photo);
      
      // Merge into metadata JSONB
      const newMeta = { ...photo.metadata };
      newMeta.seo_title = seoTitle;
      newMeta.meta_description = metaDesc;
      newMeta.alt_text_suggestion = altText;
      newMeta.seo_backfilled_at = new Date().toISOString();
      
      const metaJson = JSON.stringify(newMeta);
      
      // Update database
      await sql`
        UPDATE photos 
        SET metadata = ${metaJson}::jsonb, updated_at = NOW()
        WHERE id = ${photo.id}
      `;
      
      results.push({ id: photo.id, slug: photo.slug, seoTitle });
      stats.updated++;
      
    } catch (err) {
      stats.errors++;
      log(`ERROR: Photo ${photo.id} (${photo.slug}): ${err.message}`);
    }
  }
  
  return { done: photos.length < BATCH_SIZE, count: photos.length, samples: results.slice(0, 3) };
}

// ─── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════════════');
  log('SEO BACKFILL BATCH — STARTED');
  log(`Batch size: ${BATCH_SIZE} | Progress every: ${PROGRESS_EVERY}`);
  log('═══════════════════════════════════════════════════════════════');
  
  // Get total count first
  const countResult = await sql`
    SELECT COUNT(*) as cnt
    FROM photos p
    WHERE p.is_active = true
      AND p.ready_for_public_render = true
      AND p.search_ready = true
      AND (p.metadata IS NULL OR p.metadata::jsonb->>'seo_title' IS NULL OR p.metadata::jsonb->>'seo_title' = '')
  `;
  const totalMissing = Number(countResult[0]?.cnt || 0);
  log(`Total photos missing seo_title: ${totalMissing}`);
  
  if (totalMissing === 0) {
    log('No photos need processing. Exiting.');
    process.exit(0);
  }
  
  let offset = 0;
  let isDone = false;
  
  while (!isDone) {
    const result = await processBatch(offset);
    stats.processed += result.count;
    
    if (result.count > 0) {
      log(`Batch [offset=${offset}] — processed ${result.count}, updated ${stats.updated} total`);
      
      if (result.samples && result.samples.length > 0) {
        for (const s of result.samples) {
          log(`  SAMPLE: id=${s.id} slug=${s.slug} → "${s.seoTitle}"`);
        }
      }
    }
    
    if (result.done) {
      isDone = true;
    }
    
    offset += BATCH_SIZE;
    
    // Progress log every PROGRESS_EVERY
    if (stats.processed % PROGRESS_EVERY < BATCH_SIZE) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
      log(`PROGRESS: ${stats.processed}/${totalMissing} processed (${((stats.processed / totalMissing) * 100).toFixed(1)}%) | ${stats.updated} updated | ${stats.errors} errors | ${elapsed}s elapsed`);
    }
  }
  
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  log('═══════════════════════════════════════════════════════════════');
  log(`SEO BACKFILL BATCH — COMPLETE`);
  log(`Total processed: ${stats.processed}`);
  log(`Total updated:   ${stats.updated}`);
  log(`Total errors:    ${stats.errors}`);
  log(`Time elapsed:    ${elapsed}s`);
  log(`Rate:            ${(stats.processed / elapsed).toFixed(1)} records/sec`);
  log('═══════════════════════════════════════════════════════════════');
  
  logStream.end();
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  logStream.end();
  process.exit(1);
});
