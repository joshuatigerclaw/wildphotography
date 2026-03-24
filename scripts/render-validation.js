/**
 * Render Validation Script for WildPhotography
 * 
 * Validates that derivative rebuild completed successfully by checking:
 * 1. Recently rebuilt photos have accessible thumbnail URLs
 * 2. Key page types render without broken images
 * 
 * Run: node scripts/render-validation.js
 */

const { neon } = require('@neondatabase/serverless');

const NEON_DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const SITE_BASE = process.env.SITE_BASE || 'https://wildphotography.com';

const sql = neon(NEON_DB);

const SIZES = ['thumb', 'small', 'medium', 'large'];

async function checkUrlaccessible(url) {
  if (!url) return { accessible: false, status: 0, error: 'No URL' };
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return { accessible: res.ok || res.status === 404, status: res.status, error: null };
  } catch (e) {
    return { accessible: false, status: 0, error: e.message };
  }
}

async function validateDerivativeUrls() {
  console.log('=== Derivative URL Validation ===\n');
  
  // Get recently rebuilt photos - those with derivatives_complete = true 
  // and updated recently (from derivative rebuild)
  // Note: No column aliases - Neon returns original column names
  const recentPhotos = await sql(`
    SELECT id, slug, title, thumb_url, small_url, medium_url, large_url
    FROM photos 
    WHERE derivatives_complete = true 
      AND ready_for_public_render = true
      AND (thumb_url IS NOT NULL AND thumb_url <> '')
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 50
  `);
  
  console.log(`Found ${recentPhotos.length} photos with complete derivatives\n`);
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const photo of recentPhotos.slice(0, 20)) {
    const checks = [];
    for (const size of SIZES) {
      const urlKey = `${size}_url`;
      const url = photo[urlKey];
      if (url) {
        const result = await checkUrlaccessible(url);
        checks.push({ size, url: url.substring(0, 80), ...result });
        if (!result.accessible) {
          failed++;
          console.log(`  FAIL: ${photo.slug} ${size} -> ${result.status} ${result.error || ''}`);
        } else {
          passed++;
        }
      }
    }
    
    // Log failures only
    const sizeFailures = checks.filter(c => !c.accessible);
    if (sizeFailures.length > 0) {
      failures.push({ photoId: photo.id, slug: photo.slug, failedSizes: sizeFailures });
      console.log(`❌ photo_${photo.id} (${photo.slug}) - ${sizeFailures.map(s => `${s.size}: ${s.error || s.status}`).join(', ')}`);
    }
  }
  
  console.log(`\nDerivative URL Results: ${passed} passed, ${failed} failed`);
  return { passed, failed, failures };
}

async function validatePageRendering() {
  console.log('\n=== Page Rendering Validation ===\n');
  
  const pages = [
    { name: 'Homepage', url: `${SITE_BASE}/` },
    { name: 'Galleries Index', url: `${SITE_BASE}/galleries` },
    { name: 'Search (toucan)', url: `${SITE_BASE}/search?q=toucan` },
  ];
  
  // Get a sample gallery and photo for detail page checks
  const sampleGallery = await sql(`
    SELECT g.slug FROM galleries g
    JOIN photos p ON p.id = g.cover_photo_id
    WHERE p.thumb_url IS NOT NULL AND p.thumb_url <> ''
    LIMIT 1
  `);
  
  const samplePhoto = await sql(`
    SELECT slug FROM photos 
    WHERE thumb_url IS NOT NULL 
      AND thumb_url <> ''
      AND derivatives_complete = true
      AND ready_for_public_render = true
    LIMIT 1
  `);
  
  if (sampleGallery.length > 0) {
    pages.push({ name: 'Gallery Detail', url: `${SITE_BASE}/gallery/${sampleGallery[0].slug}` });
  }
  
  if (samplePhoto.length > 0) {
    pages.push({ name: 'Photo Detail', url: `${SITE_BASE}/photo/${samplePhoto[0].slug}` });
  }
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const page of pages) {
    try {
      const res = await fetch(page.url, { redirect: 'follow' });
      const html = await res.text();
      
      // Check for broken image indicators
      const hasBrokenImages = /broken|404|ERR_|no.?image|NaN/i.test(html);
      const hasContent = html.length > 5000;
      const isOk = res.ok && hasContent && !hasBrokenImages;
      
      if (isOk) {
        console.log(`✅ ${page.name}: ${res.status} (${html.length} bytes)`);
        passed++;
      } else {
        console.log(`❌ ${page.name}: ${res.status} - broken images: ${hasBrokenImages}, content: ${hasContent}`);
        failed++;
      }
      results.push({ ...page, status: res.status, ok: isOk, bytes: html.length });
    } catch (e) {
      console.log(`❌ ${page.name}: ERROR - ${e.message}`);
      failed++;
      results.push({ ...page, ok: false, error: e.message });
    }
  }
  
  console.log(`\nPage Rendering Results: ${passed} passed, ${failed} failed`);
  return { passed, failed, results };
}

async function main() {
  console.log('WildPhotography Render Validation');
  console.log('================================\n');
  console.log(`Site: ${SITE_BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const derivativeResult = await validateDerivativeUrls();
  const pageResult = await validatePageRendering();
  
  console.log('\n=== Summary ===');
  console.log(`Derivative URLs: ${derivativeResult.passed} OK, ${derivativeResult.failed} failed`);
  console.log(`Page Rendering: ${pageResult.passed} OK, ${pageResult.failed} failed`);
  
  const totalFailed = derivativeResult.failed + pageResult.failed;
  const totalPassed = derivativeResult.passed + pageResult.passed;
  
  if (totalFailed > 0) {
    console.log(`\n⚠️  ${totalFailed} validation checks failed`);
    if (derivativeResult.failures.length > 0) {
      console.log('\nFailed photo derivatives:');
      for (const f of derivativeResult.failures.slice(0, 5)) {
        console.log(`  photo_${f.photoId}: ${f.failedSizes.map(s => `${s.size}=${s.status}`).join(', ')}`);
      }
    }
  } else {
    console.log('\n✅ All render validation checks passed');
  }
  
  // Output JSON for machine parsing
  const summary = {
    timestamp: new Date().toISOString(),
    derivativeUrls: { passed: derivativeResult.passed, failed: derivativeResult.failed },
    pageRendering: { passed: pageResult.passed, failed: pageResult.failed },
    totalPassed,
    totalFailed,
    allOk: totalFailed === 0
  };
  
  console.log('\n--- JSON OUTPUT ---');
  console.log(JSON.stringify(summary));
  
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Validation error:', e);
  process.exit(1);
});
