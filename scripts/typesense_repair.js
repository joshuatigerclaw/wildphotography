#!/usr/bin/env node
/**
 * Typesense Stale Record Removal + Retry Upsert
 * Removes records in TS that are not in Neon eligible set
 * Then retries failed upsert batches
 */

const https = require('https');
const { execSync } = require('child_process');

const TYPESENSE_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_PORT = 443;
const TYPESENSE_API_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';

const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';

const REPORT_FILE = `${process.env.HOME}/.openclaw/workspace/wildphotography/logs/typesense_repair_2026-06-02.json`;

const results = {
  run_at: new Date().toISOString(),
  stale_removed: 0,
  missing_added: 0,
  errors: [],
  status: 'running'
};

function typesenseRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      path: path,
      method: method,
      headers: {
        'X-Typesense-API-Key': TYPESENSE_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          parsed._status = res.statusCode;
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function queryNeonPhotoIds(offset, limit) {
  const sql = `SELECT id FROM photos WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != '' ORDER BY id OFFSET ${offset} LIMIT ${limit}`;
  
  const escapedSql = sql.replace(/"/g, '\\"');
  const csv = execSync(`psql "${NEON_CONN}" -t -A -F',' -c "${escapedSql}"`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });

  return csv.trim().split('\n').filter(r => r.length > 0).map(id => `photo_${id.trim()}`);
}

async function getTypesenseDocCount() {
  const res = await typesenseRequest('GET', '/collections/photos/documents?limit=0');
  return res.num_documents || 0;
}

async function exportTypesenseIdsBatch(cursor = '') {
  const path = cursor 
    ? `/collections/photos/documents?limit=1000&cursor=${cursor}`
    : '/collections/photos/documents?limit=1000';
  return typesenseRequest('GET', path);
}

async function deleteStaleFromTypesense(ids) {
  if (ids.length === 0) return { deleted: 0, errors: [] };
  
  let deleted = 0;
  const errors = [];
  
  for (const id of ids) {
    try {
      await typesenseRequest('DELETE', `/collections/photos/documents/${encodeURIComponent(id)}`);
      deleted++;
      if (deleted % 100 === 0) process.stdout.write(`  deleted ${deleted}/${ids.length}\n`);
    } catch (e) {
      // Try individual delete
      errors.push(`${id}: ${e.message}`);
    }
  }
  
  return { deleted, errors };
}

async function retryUpsertBatch(photos) {
  if (photos.length === 0) return { success: 0, failed: 0, errors: [] };
  
  const formatted = photos.map(doc => ({
    id: `photo_${doc.id}`,
    slug: doc.slug,
    title: doc.title,
    description: (doc.description || '').substring(0, 500),
    keywords: Array.isArray(doc.keywords) ? doc.keywords : (doc.keywords ? doc.keywords.split(',').map(k => k.trim()).filter(Boolean) : []),
    country: doc.country || '',
    region: doc.region || '',
    location_name: doc.location_name || '',
    species_common_name: doc.species_common_name || '',
    gallery_slug: doc.gallery_slug || '',
    thumb_url: doc.thumb_url,
    photo_url: doc.medium_url || doc.thumb_url,
    updated_at: doc.updated_at || 0
  })).filter(doc => doc.thumb_url);

  try {
    const res = await typesenseRequest('POST', '/collections/photos/documents/import', formatted);
    
    if (Array.isArray(res)) {
      const failures = res.filter(r => r !== true);
      return { 
        success: formatted.length - failures.length, 
        failed: failures.length, 
        errors: failures.filter(r => typeof r === 'object' && r.error).map(r => r.error)
      };
    }
    
    return { success: res.success || 0, failed: res.failed || 0, errors: [] };
  } catch (e) {
    return { success: 0, failed: formatted.length, errors: [e.message] };
  }
}

function queryNeonPhotosBatch(offset, limit) {
  const sql = `SELECT id, slug, title, description, keywords, country, region, location_name, species_common_name, gallery_slug, thumb_url, medium_url, updated_at 
FROM photos 
WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != ''
ORDER BY id 
OFFSET ${offset} 
LIMIT ${limit};`;

  const escapedSql = sql.replace(/"/g, '\\"');
  const csv = execSync(`psql "${NEON_CONN}" -t -A -F'|' -c "${escapedSql}"`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });

  const rows = csv.trim().split('\n').filter(r => r.length > 0);
  return rows.map(row => {
    const fields = row.split('|');
    return {
      id: fields[0] ? parseInt(fields[0]) : null,
      slug: fields[1] || '',
      title: fields[2] || '',
      description: (fields[3] || '').substring(0, 500),
      keywords: fields[4] || '',
      country: fields[5] || '',
      region: fields[6] || '',
      location_name: fields[7] || '',
      species_common_name: fields[8] || '',
      gallery_slug: fields[9] || '',
      thumb_url: fields[10] || '',
      medium_url: fields[11] || '',
      updated_at: fields[12] ? parseInt(fields[12]) : 0
    };
  }).filter(r => r.id !== null);
}

async function run() {
  console.log('=== Typesense Stale Removal + Retry ===');
  console.log(`Started: ${results.run_at}`);

  // Get current state
  const neonEligible = parseInt(execSync(`psql "${NEON_CONN}" -t -A -c "SELECT COUNT(*) FROM photos WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != '';"`, { encoding: 'utf8' }).trim());
  console.log(`Neon eligible: ${neonEligible}`);

  const tsCount = await getTypesenseDocCount();
  console.log(`Typesense count: ${tsCount}`);
  console.log(`Estimated stale: ${tsCount - neonEligible}`);
  console.log('');

  // Export all TS IDs
  console.log('[PHASE 1] Exporting Typesense IDs...');
  const tsIds = new Set();
  let cursor = '';
  let exported = 0;
  
  do {
    const res = await exportTypesenseIdsBatch(cursor);
    if (res.document && res.document.length > 0) {
      for (const doc of res.document) {
        tsIds.add(doc.id);
        exported++;
      }
      cursor = res.cursor || '';
    } else {
      break;
    }
  } while (cursor);

  console.log(`Exported ${exported} TS IDs`);
  console.log('');

  // Build Neon eligible IDs set
  console.log('[PHASE 2] Building Neon eligible ID set...');
  const neonIds = new Set();
  let offset = 0;
  const batchSize = 1000;
  
  while (true) {
    const ids = queryNeonPhotoIds(offset, batchSize);
    if (ids.length === 0) break;
    for (const id of ids) neonIds.add(id);
    offset += batchSize;
    process.stdout.write(`\r  Collected ${neonIds.size} Neon IDs...`);
    if (ids.length < batchSize) break;
  }
  console.log(`\nNeon eligible IDs: ${neonIds.size}`);

  // Find stale
  console.log('\n[PHASE 3] Identifying stale TS records...');
  const staleIds = [];
  for (const tsId of tsIds) {
    if (!neonIds.has(tsId)) {
      staleIds.push(tsId);
    }
  }
  console.log(`Stale records to remove: ${staleIds.length}`);

  // Remove stale in batches
  console.log('\n[PHASE 4] Removing stale records...');
  let staleRemoved = 0;
  for (let i = 0; i < staleIds.length; i += 100) {
    const batch = staleIds.slice(i, i + 100);
    const batchNum = Math.floor(i / 100) + 1;
    process.stdout.write(`Batch ${batchNum}/${Math.ceil(staleIds.length/100)}: deleting ${batch.length}...`);
    
    const result = await deleteStaleFromTypesense(batch);
    staleRemoved += result.deleted;
    console.log(` done (${result.deleted} removed)`);
    
    await new Promise(r => setTimeout(r, 50));
  }
  results.stale_removed = staleRemoved;
  console.log(`Total stale removed: ${staleRemoved}`);

  // Retry failed batches (23, 25, 27, 29, 31) = offsets 11000, 12000, 13000, 14000, 15000
  console.log('\n[PHASE 5] Retrying failed upsert batches...');
  const failedOffsets = [11000, 12000, 13000, 14000, 15000];
  let retryAdded = 0;

  for (const offset of failedOffsets) {
    process.stdout.write(`Retry offset ${offset}...`);
    const photos = queryNeonPhotosBatch(offset, 500);
    if (photos.length === 0) {
      console.log(' no records');
      continue;
    }
    
    const result = await retryUpsertBatch(photos);
    retryAdded += result.success;
    console.log(` upserted ${result.success}, failed ${result.failed}`);
    await new Promise(r => setTimeout(r, 200));
  }

  results.missing_added = 3276 + retryAdded;
  console.log(`\nRetry added: ${retryAdded} (prev: 3276, total: ${results.missing_added})`);

  // Final state
  console.log('\n[PHASE 6] Verifying final state...');
  const finalTsCount = await getTypesenseDocCount();
  const finalNeon = parseInt(execSync(`psql "${NEON_CONN}" -t -A -c "SELECT COUNT(*) FROM photos WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != '';"`, { encoding: 'utf8' }).trim());
  
  results.status = 'completed';
  results.neon_eligible = finalNeon;
  results.typesense_count = finalTsCount;
  results.final_drift = finalTsCount - finalNeon;

  console.log('\n=== FINAL STATE ===');
  console.log(`Neon eligible: ${finalNeon}`);
  console.log(`Typesense count: ${finalTsCount}`);
  console.log(`Remaining drift: ${results.final_drift}`);
  console.log(`Stale removed: ${results.stale_removed}`);
  console.log(`Missing added: ${results.missing_added}`);
  if (results.errors.length > 0) console.log(`Errors: ${results.errors.length}`);

  const fs = require('fs');
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nReport: ${REPORT_FILE}`);
  console.log('\n=== COMPLETE ===');
}

run().catch(e => {
  console.error('Fatal:', e);
  results.errors.push(`Fatal: ${e.message}`);
  results.status = 'failed';
  try {
    const fs = require('fs');
    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  } catch(e2) {}
  process.exit(1);
});