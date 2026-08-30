/**
 * WildPhotography — Derivative Integrity Diagnostic
 * Run: node scripts/derivative-integrity-check.js
 * 
 * Checks: which derivative URLs are broken vs working, identifies patterns
 */

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_8MuC1tvKIOoj@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function checkUrl(url) {
  if (!url || url === '') return null;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'follow' });
    return res.ok ? '200' : res.status.toString();
  } catch { return 'ERROR'; }
}

async function main() {
  console.log('=== Derivative Integrity Diagnostic ===\n');
  
  // Sample 200 published photos with derivatives set
  const photos = await sql`
    SELECT id, slug, thumb_url, small_url, medium_url, large_url, r2_original_key
    FROM photos 
    WHERE status != 'archived' 
      AND ready_for_public_render = true
      AND derivatives_complete = true
      AND thumb_url IS NOT NULL AND thumb_url != ''
      AND small_url IS NOT NULL AND small_url != ''
    ORDER BY RANDOM() 
    LIMIT 200
  `;
  
  console.log(`Sampling ${photos.length} published photos with derivatives...\n`);
  
  const results = await Promise.all(photos.map(async (p) => {
    const [thumb, small, medium, large] = await Promise.all([
      checkUrl(p.thumb_url),
      checkUrl(p.small_url),
      checkUrl(p.medium_url),
      checkUrl(p.large_url),
    ]);
    return { id: p.id, slug: p.slug, thumb, small, medium, large };
  }));
  
  const thumbFails = results.filter(r => r.thumb !== '200').length;
  const smallFails = results.filter(r => r.small !== '200').length;
  const mediumFails = results.filter(r => r.medium !== '200').length;
  const largeFails = results.filter(r => r.large !== '200').length;
  const totalFail = results.filter(r => r.thumb !== '200' || r.small !== '200' || r.medium !== '200' || r.large !== '200').length;
  
  console.log('=== Derivative Availability ===');
  console.log(`Thumb:  ${results.length - thumbFails}/${results.length} OK (${thumbFails} fail)`);
  console.log(`Small:  ${results.length - smallFails}/${results.length} OK (${smallFails} fail)`);
  console.log(`Medium: ${results.length - mediumFails}/${results.length} OK (${mediumFails} fail)`);
  console.log(`Large:  ${results.length - largeFails}/${results.length} OK (${largeFails} fail)`);
  console.log(`\nPhotos with ALL derivatives OK: ${results.length - totalFail}/${results.length}`);
  console.log(`Failure rate: ${Math.round((totalFail/results.length)*100)}%`);
  
  // Identify pattern: show 10 failing small URLs
  console.log('\n=== Sample Failing Small URLs ===');
  results.filter(r => r.small !== '200').slice(0, 10).forEach(r => {
    const photo = photos.find(p => p.id === r.id);
    console.log(`ID ${r.id} [${r.small}]`);
  });
  
  // Identify path patterns in failing vs passing
  const failingSmall = results.filter(r => r.small !== '200').map(r => photos.find(p => p.id === r.id).small_url);
  const passingSmall = results.filter(r => r.small === '200').map(r => photos.find(p => p.id === r.id).small_url);
  
  const failingPatterns = {};
  failingSmall.forEach(url => {
    const pattern = url.replace(/[a-f0-9]{64}/g, '{hash}').replace(/[a-zA-Z0-9_-]+\\.(jpg|webp|png)/g, '{file}');
    failingPatterns[pattern] = (failingPatterns[pattern] || 0) + 1;
  });
  
  const passingPatterns = {};
  passingSmall.forEach(url => {
    const pattern = url.replace(/[a-f0-9]{64}/g, '{hash}').replace(/[a-zA-Z0-9_-]+\\.(jpg|webp|png)/g, '{file}');
    passingPatterns[pattern] = (passingPatterns[pattern] || 0) + 1;
  });
  
  console.log('\n=== Path Patterns (Failing) ===');
  Object.entries(failingPatterns).sort((a,b) => b[1]-a[1]).forEach(([p,c]) => console.log(`  ${c}x: ${p}`));
  
  console.log('\n=== Path Patterns (Passing) ===');
  Object.entries(passingPatterns).sort((a,b) => b[1]-a[1]).forEach(([p,c]) => console.log(`  ${c}x: ${p}`));
  
  // Estimate total missing derivatives
  const totalActive = await sql`SELECT COUNT(*)::int as cnt FROM photos WHERE status != 'archived' AND ready_for_public_render = true AND derivatives_complete = true`;
  const missingEstimate = Math.round(totalActive[0].cnt * (smallFails / results.length));
  console.log(`\n=== Estimate ===`);
  console.log(`Active photos with derivatives: ${totalActive[0].cnt}`);
  console.log(`Estimated broken small derivatives: ~${missingEstimate}`);
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    sampleSize: results.length,
    thumbFails, smallFails, mediumFails, largeFails, totalFail,
    failPct: Math.round((totalFail/results.length)*100),
    failingPatterns,
    passingPatterns,
    estimatedBrokenSmall: missingEstimate
  };
  
  const fs = require('fs');
  fs.writeFileSync('/Users/joshuatenbrink/wildphotography_cloudflare_src/logs/derivative-integrity-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to logs/derivative-integrity-report.json');
}

main().catch(e => { console.error(e.message); process.exit(1); });