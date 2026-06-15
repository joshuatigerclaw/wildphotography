#!/usr/bin/env node
/**
 * Typesense Targeted Retry - failed batches 22-33
 * Using smaller batch size and retry logic
 */

const https = require('https');
const { execSync } = require('child_process');

const TYPESENSE_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_PORT = 443;
const TYPESENSE_API_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';

const NEON_CONN = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';

const REPORT_FILE = `${process.env.HOME}/.openclaw/workspace/wildphotography/logs/typesense_retry_2026-06-02.json`;

// Failed batches were 22-33 (10500 to end), retry with 100-record chunks
const START_OFFSET = 10500;
const BATCH_SIZE = 100;

const results = {
  run_at: new Date().toISOString(),
  missing_added: 0,
  stale_removed: 0,
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
          reject(new Error(`Parse error: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
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
    const rawKeywords = fields[4] || '';
    const keywords = rawKeywords.split(',').map(k => k.trim()).filter(Boolean);
    
    return {
      id: fields[0] ? parseInt(fields[0]) : null,
      slug: (fields[1] || '').substring(0, 200),
      title: (fields[2] || '').substring(0, 200),
      description: (fields[3] || '').substring(0, 300),
      keywords: keywords.slice(0, 30), // cap at 30 keywords
      country: (fields[5] || '').substring(0, 100),
      region: (fields[6] || '').substring(0, 100),
      location_name: (fields[7] || '').substring(0, 100),
      species_common_name: (fields[8] || '').substring(0, 100),
      gallery_slug: (fields[9] || '').substring(0, 100),
      thumb_url: (fields[10] || '').substring(0, 500),
      medium_url: (fields[11] || '').substring(0, 500),
      updated_at: fields[12] ? Math.floor(new Date(fields[12]).getTime() / 1000) : 0
    };
  }).filter(r => r.id !== null && r.thumb_url);
}

async function upsertBatch(photos) {
  if (photos.length === 0) return { success: 0, failed: 0 };
  
  const formatted = photos.map(doc => ({
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
    
    if (Array.isArray(res)) {
      const failures = res.filter(r => r !== true);
      return { 
        success: formatted.length - failures.length, 
        failed: failures.length,
        error_details: failures.slice(0, 3)
      };
    }
    
    return { success: res.success || 0, failed: res.failed || 0 };
  } catch (e) {
    return { success: 0, failed: photos.length, error_details: [e.message] };
  }
}

async function run() {
  console.log('=== Typesense Retry - batches 22-33 (offset 10500+) ===');
  console.log(`Batch size: ${BATCH_SIZE}`);
  
  let totalAdded = 0;
  let totalFailed = 0;
  let offset = START_OFFSET;
  let batchNum = Math.floor(START_OFFSET / BATCH_SIZE) + 1;
  let chunksProcessed = 0;
  
  while (true) {
    const photos = queryNeonPhotosBatch(offset, BATCH_SIZE);
    if (photos.length === 0) {
      console.log(`\nNo more records at offset ${offset}`);
      break;
    }
    
    process.stdout.write(`Batch ${batchNum}: offset ${offset}, ${photos.length} records... `);
    
    const result = await upsertBatch(photos);
    totalAdded += result.success;
    totalFailed += result.failed;
    
    if (result.success > 0) {
      console.log(`OK (${result.success} added)`);
    } else {
      console.log(`FAILED (${result.failed} failed)`);
      if (result.error_details) {
        for (const e of result.error_details) {
          results.errors.push(`offset ${offset}: ${e}`);
        }
      }
    }
    
    offset += BATCH_SIZE;
    batchNum++;
    chunksProcessed++;
    
    // Progress indicator
    if (chunksProcessed % 10 === 0) {
      process.stdout.write(`\n  [${chunksProcessed} chunks processed, ${totalAdded} added so far]\n`);
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 150));
    
    if (photos.length < BATCH_SIZE) break;
  }

  results.missing_added = totalAdded;
  results.total_failed = totalFailed;

  // Final count check
  console.log('\n[VERIFICATION] Checking Typesense count...');
  await new Promise(r => setTimeout(r, 2000)); // let TS settle
  
  try {
    const { execSync } = require('child_process');
    const tsCheck = execSync(`curl -s "https://uibn03zvateqwdx2p-1.a1.typesense.net:443/collections/photos" -H "X-Typesense-API-Key: MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7" | python3 -c "import sys,json; print(json.load(sys.stdin)['num_documents'])"`, { encoding: 'utf8', timeout: 15000 });
    results.typesense_count = parseInt(tsCheck.trim());
    
    const neonCheck = parseInt(execSync(`psql "${NEON_CONN}" -t -A -c "SELECT COUNT(*) FROM photos WHERE search_ready = true AND typesense_indexable = true AND thumb_url IS NOT NULL AND thumb_url != '';"`, { encoding: 'utf8' }).trim());
    results.neon_eligible = neonCheck;
    results.final_drift = results.typesense_count - neonCheck;
  } catch (e) {
    results.errors.push(`Verification error: ${e.message}`);
  }

  results.status = 'completed';
  
  console.log('\n=== RESULTS ===');
  console.log(`Records added: ${totalAdded}`);
  console.log(`Records failed: ${totalFailed}`);
  if (results.typesense_count) {
    console.log(`Typesense count: ${results.typesense_count}`);
    console.log(`Neon eligible: ${results.neon_eligible}`);
    console.log(`Final drift: ${results.final_drift}`);
  }
  if (results.errors.length > 0) {
    console.log(`Errors: ${results.errors.length}`);
  }

  const fs = require('fs');
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nReport: ${REPORT_FILE}`);
}

run().catch(e => {
  console.error('Fatal:', e.message);
  results.errors.push(e.message);
  results.status = 'failed';
  try {
    const fs = require('fs');
    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  } catch(e2) {}
  process.exit(1);
});