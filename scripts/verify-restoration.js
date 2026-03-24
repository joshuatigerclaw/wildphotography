/**
 * Verification Script for Derivative Restoration
 * 
 * Checks:
 * 1. R2 bucket contains expected derivative keys
 * 2. Database URLs are updated correctly
 * 3. Sample images load via HTTP
 * 
 * Usage:
 *   node scripts/verify-restoration.js
 * 
 * Environment:
 *   R2_SECRET_KEY - Required for R2 checks
 *   NEW_PUBLIC_HOSTNAME - The new R2 public URL (without trailing slash)
 */

const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { neon } = require('@neondatabase/serverless');

const R2_ACCOUNT_ID = '3ec62f93675c404fe4a9a4949e38e5e5';
const R2_BUCKET = 'wildphoto-storage';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// UPDATE THIS to match what you configured in restore-derivatives.js
const NEW_PUBLIC_HOSTNAME = process.env.NEW_PUBLIC_HOSTNAME || 'pub-YOUR-NEW-PUBLIC-HOSTNAME.r2.dev';

const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const NEON_DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const r2 = R2_SECRET_KEY ? new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCOUNT_ID,
    secretAccessKey: R2_SECRET_KEY,
  },
}) : null;

const sql = neon(NEON_DB);

const SIZES = ['thumb', 'small', 'medium', 'large'];

async function checkR2Object(key) {
  if (!r2) return { exists: false, error: 'No R2 credentials' };
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return { exists: true };
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    return { exists: false, error: error.message };
  }
}

async function verifyRestoration() {
  console.log('===========================================');
  console.log('RESTORATION VERIFICATION');
  console.log('===========================================');
  console.log(`New hostname: ${NEW_PUBLIC_HOSTNAME}`);
  console.log('');
  
  // 1. Check sample photos in database
  console.log('1. Checking database records...');
  const photos = await sql`
    SELECT id, slug, thumb_url, small_url, medium_url, large_url
    FROM photos 
    WHERE is_active = true 
      AND thumb_url IS NOT NULL
    ORDER BY id
    LIMIT 10
  `;
  console.log(`   Found ${photos.length} sample photos with URLs`);
  
  // Check how many use new hostname
  const newHostCount = photos.filter(p => 
    p.thumb_url && p.thumb_url.includes(NEW_PUBLIC_HOSTNAME)
  ).length;
  console.log(`   Using new hostname: ${newHostCount}/${photos.length}`);
  
  // Check how many still use old hostname  
  const oldHostCount = photos.filter(p => 
    p.thumb_url && p.thumb_url.includes('pub-7d412c6efb5943b5bc587e695e22001e.r2.dev')
  ).length;
  console.log(`   Still using old hostname: ${oldHostCount}/${photos.length}`);
  console.log('');
  
  // 2. Verify R2 keys exist
  console.log('2. Checking R2 derivative keys...');
  let r2Ok = 0;
  let r2Missing = 0;
  
  for (const photo of photos.slice(0, 5)) {
    for (const size of SIZES) {
      const key = `derivatives/${size}s/${photo.id}-${size === 'thumb' ? 'thumb' : size === 'small' ? 'small' : size === 'medium' ? 'medium' : 'large'}.jpg`;
      const result = await checkR2Object(key);
      if (result.exists) {
        r2Ok++;
      } else {
        r2Missing++;
        console.log(`   Missing: ${key} (${result.error || '404'})`);
      }
    }
  }
  console.log(`   Found: ${r2Ok}, Missing: ${r2Missing}`);
  console.log('');
  
  // 3. HTTP accessibility check (sample)
  console.log('3. HTTP accessibility (sample check)...');
  if (photos[0] && photos[0].large_url) {
    const testUrl = photos[0].large_url;
    console.log(`   Testing: ${testUrl}`);
    
    try {
      const got = require('got');
      const response = await got.head(testUrl, { timeout: 10000 });
      console.log(`   Status: ${response.statusCode} ${response.statusMessage}`);
      if (response.statusCode === 200) {
        console.log('   ✓ Image is accessible!');
      } else {
        console.log('   ✗ Unexpected status');
      }
    } catch (error) {
      console.log(`   ✗ Error: ${error.message}`);
    }
  }
  console.log('');
  
  // 4. Summary
  console.log('===========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('===========================================');
  
  const allGood = newHostCount === photos.length && r2Missing === 0;
  
  if (allGood) {
    console.log('✓ All checks passed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run sql-hostname-replace.sql to update all DB URLs');
    console.log('2. Deploy new frontend code with updated R2_PUBLIC_BASE');
  } else {
    console.log('⚠ Some issues detected:');
    if (oldHostCount > 0) {
      console.log(`  - ${oldHostCount} photos still use old hostname`);
    }
    if (r2Missing > 0) {
      console.log(`  - ${r2Missing} R2 derivative keys missing`);
    }
  }
  
  return allGood;
}

verifyRestoration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Verification error:', error);
    process.exit(1);
  });
