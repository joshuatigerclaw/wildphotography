/**
 * Generate Derivatives from Test Image
 * 
 * This script downloads a test image and uploads derivatives to R2.
 * Uses Cloudflare API for upload.
 */

const TEST_IMAGE = {
  url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=2400',
  slug: 'scarlet-macaw-test',
  title: 'Scarlet Macaw (Test)',
};

const SIZES = [
  { name: 'thumb', width: 400, path: 'derivatives/thumbs/' },
  { name: 'small', width: 900, path: 'derivatives/small/' },
  { name: 'medium', width: 1600, path: 'derivatives/medium/' },
  { name: 'large', width: 2400, path: 'derivatives/large/' },
];

const R2_API = 'https://api.cloudflare.com/client/v4/accounts/3ec62f93675c404fe4a9a4949e38e5e5/r2/buckets/wildphoto-storage/objects';

async function downloadImage(url) {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}

async function uploadToR2(key, buffer) {
  console.log(`  Uploading ${key}...`);
  
  const result = await fetch(`${R2_API}/${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'image/jpeg',
    },
    body: buffer,
  });
  
  if (!result.ok) {
    const error = await result.text();
    throw new Error(`Upload failed: ${result.status} - ${error}`);
  }
  
  console.log(`  ✅ ${key}`);
}

async function resizeAndUpload(originalBuffer, size, slug) {
  // For this test, we'll just use the original for all sizes
  // In production, you'd use sharp to resize
  const key = `${size.path}${slug}-${size.name}.jpg`;
  await uploadToR2(key, originalBuffer);
  return key;
}

async function main() {
  console.log('🧪 Image Pipeline Test\n');
  console.log(`Downloading: ${TEST_IMAGE.title}`);
  
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    console.error('❌ CLOUDFLARE_API_TOKEN not set');
    process.exit(1);
  }
  
  // Download original
  console.log('\n1. Downloading original...');
  const originalBuffer = await downloadImage(TEST_IMAGE.url);
  console.log(`   Size: ${(originalBuffer.length / 1024).toFixed(1)}KB`);
  
  // Upload original
  console.log('\n2. Uploading original...');
  const originalKey = `originals/${TEST_IMAGE.slug}.jpg`;
  await uploadToR2(originalKey, originalBuffer);
  
  // Generate derivatives (using original for now)
  console.log('\n3. Generating derivatives...');
  const derivativeKeys = {};
  
  for (const size of SIZES) {
    const key = await resizeAndUpload(originalBuffer, size, TEST_IMAGE.slug);
    derivativeKeys[size.name] = key;
  }
  
  console.log('\n✅ Pipeline test complete!');
  console.log('\nUploaded files:');
  console.log(`  Original: ${originalKey}`);
  for (const [name, key] of Object.entries(derivativeKeys)) {
    console.log(`  ${name}: ${key}`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
