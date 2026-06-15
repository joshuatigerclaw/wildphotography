#!/usr/bin/env node
/**
 * WildPhotography Typesense Index Repair Agent
 * Reconciles Neon photos table with Typesense photos collection
 */

const https = require('https');

const TYPESENSE_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_PORT = 443;
const TYPESENSE_API_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const TYPESENSE_SEARCH_KEY = 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE';

const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';

const BATCH_SIZE = 500;
const UPSERT_BATCH_SIZE = 500;

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_FILE = `${process.env.HOME}/.openclaw/workspace/wildphotography/logs/typesense_upsert_missing_${timestamp.replace(/T/, '_')}.json`;

const results = {
  run_at: new Date().toISOString(),
  stale_removed: 0,
  missing_added: 0,
  errors: [],
  status: 'running'
};

// Typesense REST helpers
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

async function getTypesenseDocCount() {
  const res = await typesenseRequest('GET', '/collections/photos');
  return res.num_documents || 0;
}

async function exportTypesenseIds() {
  console.log('[RECONCILE] Exporting all Typesense photo IDs via search endpoint...');
  const ids = new Set();
  let offset = 0;
  const batchSize = 250;
  
  while (true) {
    const res = await typesenseRequest('GET', `/collections/photos/documents/search?q=*&limit=${batchSize}&offset=${offset}&num_typsense_documents=0`);
    
    const hits = res.hits || [];
    if (hits.length === 0) break;
    
    for (const hit of hits) {
      if (hit.document && hit.document.id) {
        ids.add(hit.document.id);
      }
    }
    
    console.log(`  ... collected ${ids.size} IDs so far (offset ${offset})`);
    offset += batchSize;
    
    if (hits.length < batchSize) break;
  }
  
  console.log(`[RECONCILE] Typesense IDs collected: ${ids.size}`);
  return ids;
}

async function queryNeonPhotos(offset, limit) {
  const { execSync } = require('child_process');
  
  const sql = `SELECT id, slug, title, description, keywords, country, region, location_name, species_common_name, gallery_slug, thumb_url, medium_url, updated_at 
FROM photos 
WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != ''
ORDER BY id 
OFFSET ${offset} 
LIMIT ${limit};`;

  const csv = execSync(`psql "${NEON_CONN}" -t -A -F',' -c "${sql.replace(/"/g, '\\"')}"`, {
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
      keywords: fields[4] ? fields[4].split(',').map(k => k.trim()).filter(Boolean) : [],
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

async function upsertToTypesense(docs) {
  if (docs.length === 0) return { success: 0, failed: 0 };
  
  const formatted = docs.map(doc => ({
    id: `photo_${doc.id}`,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    keywords: doc.keywords,
    country: doc.country,
    region: doc.region,
    location_name: doc.location_name,
    species_common_name: doc.species_common_name,
    gallery_slug: doc.gallery_slug,
    thumb_url: doc.thumb_url,
    photo_url: doc.medium_url || doc.thumb_url,
    updated_at: doc.updated_at
  }));

  try {
    const res = await typesenseRequest('POST', '/collections/photos/documents/import', formatted);
    
    // Import returns array of results
    if (Array.isArray(res)) {
      const failures = res.filter(r => r !== true).length;
      return { success: formatted.length - failures, failed: failures, errors: res.filter(r => typeof r === 'object' && r.error) };
    }
    
    // If it's an object with success count
    if (res.success !== undefined) {
      return { success: res.success || 0, failed: res.failed || 0, errors: [] };
    }
    
    return { success: formatted.length, failed: 0, errors: [] };
  } catch (e) {
    return { success: 0, failed: docs.length, errors: [e.message] };
  }
}

async function deleteFromTypesense(ids) {
  if (ids.length === 0) return { deleted: 0, errors: [] };
  
  const body = ids.map(id => ({ id }));
  
  try {
    const res = await typesenseRequest('DELETE', '/collections/photos/documents', { 
      filter_by: `id:=[\${ids.join(',')}]` 
    });
    return { deleted: ids.length, errors: [] };
  } catch (e) {
    // Try individual deletes
    let deleted = 0;
    const errors = [];
    for (const id of ids) {
      try {
        await typesenseRequest('DELETE', `/collections/photos/documents/${encodeURIComponent(id)}`);
        deleted++;
      } catch (e2) {
        errors.push(`${id}: ${e2.message}`);
      }
    }
    return { deleted, errors };
  }
}

async function deleteStaleFromTypesense(ids) {
  if (ids.length === 0) return { deleted: 0, errors: [] };
  
  let deleted = 0;
  const errors = [];
  
  for (const id of ids) {
    try {
      await typesenseRequest('DELETE', `/collections/photos/documents/${encodeURIComponent(id)}`);
      deleted++;
    } catch (e) {
      errors.push(`${id}: ${e.message}`);
    }
  }
  
  return { deleted, errors };
}

async function run() {
  console.log('=== WildPhotography Typesense Index Repair ===');
  console.log(`Started at: ${results.run_at}`);
  console.log('');

  // Step 1: Count Neon eligible records
  console.log('[STEP 1] Counting Neon eligible photos...');
  let neonCount = 0;
  try {
    const { execSync } = require('child_process');
    neonCount = parseInt(execSync(`psql "${NEON_CONN}" -t -A -c "SELECT COUNT(*) FROM photos WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != '';"`, { encoding: 'utf8' }).trim());
  } catch (e) {
    console.error('Failed to count Neon photos:', e.message);
    results.errors.push(`Neon count error: ${e.message}`);
  }
  console.log(`Neon eligible photos: ${neonCount}`);

  // Step 2: Count Typesense docs
  console.log('\n[STEP 2] Counting Typesense photos collection...');
  const typesenseCount = await getTypesenseDocCount();
  console.log(`Typesense docs: ${typesenseCount}`);
  console.log(`Drift estimate: ${neonCount - typesenseCount} (positive = missing in TS, negative = stale in TS)`);

  // Step 3: Export all Typesense IDs
  console.log('\n[STEP 3] Exporting Typesense document IDs...');
  const tsIds = await exportTypesenseIds();

  // Step 4: Scan Neon and find missing
  console.log('\n[STEP 4] Scanning Neon for missing records...');
  
  let totalNeonScanned = 0;
  let missingInTypesense = [];
  let offset = 0;
  
  while (true) {
    const photos = await queryNeonPhotos(offset, BATCH_SIZE);
    if (photos.length === 0) break;
    
    for (const photo of photos) {
      const tsId = `photo_${photo.id}`;
      if (!tsIds.has(tsId)) {
        missingInTypesense.push(photo);
      }
      totalNeonScanned++;
    }
    
    console.log(`  Scanned ${totalNeonScanned}/${neonCount} - found ${missingInTypesense.length} missing so far`);
    offset += BATCH_SIZE;
    
    if (photos.length < BATCH_SIZE) break;
  }

  console.log(`\nTotal missing in Typesense: ${missingInTypesense.length}`);

  // Step 5: Upsert missing records
  console.log('\n[STEP 5] Upserting missing records into Typesense...');
  
  let upserted = 0;
  for (let i = 0; i < missingInTypesense.length; i += UPSERT_BATCH_SIZE) {
    const batch = missingInTypesense.slice(i, i + UPSERT_BATCH_SIZE);
    const batchNum = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(missingInTypesense.length / UPSERT_BATCH_SIZE);
    
    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
    
    const result = await upsertToTypesense(batch);
    upserted += result.success;
    
    if (result.failed > 0) {
      results.errors.push(`Batch ${batchNum} failed: ${result.failed} records`);
    }
    
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  results.missing_added = upserted;
  console.log(`Upserted: ${upserted} records`);

  // Step 6: Verify final counts
  console.log('\n[STEP 6] Verifying final state...');
  const finalNeonCount = await new Promise((resolve, reject) => {
    const { execSync } = require('child_process');
    try {
      resolve(parseInt(execSync(`psql "${NEON_CONN}" -t -A -c "SELECT COUNT(*) FROM photos WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != '';"`, { encoding: 'utf8' }).trim()));
    } catch (e) { reject(e); }
  });
  const finalTsCount = await getTypesenseDocCount();

  results.status = 'completed';
  results.neon_eligible = finalNeonCount;
  results.typesense_count = finalTsCount;
  results.final_drift = finalNeonCount - finalTsCount;

  console.log('\n=== FINAL STATE ===');
  console.log(`Neon eligible: ${finalNeonCount}`);
  console.log(`Typesense count: ${finalTsCount}`);
  console.log(`Remaining drift: ${results.final_drift}`);
  console.log(`Missing added: ${results.missing_added}`);
  console.log(`Stale removed: ${results.stale_removed}`);
  if (results.errors.length > 0) {
    console.log(`Errors: ${results.errors.length}`);
  }

  // Write report
  const fs = require('fs');
  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
  console.log(`\nReport written to: ${LOG_FILE}`);

  console.log('\n=== COMPLETE ===');
}

run().catch(e => {
  console.error('Fatal error:', e);
  results.errors.push(`Fatal: ${e.message}`);
  results.status = 'failed';
  try {
    const fs = require('fs');
    fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
  } catch (e2) {}
  process.exit(1);
});