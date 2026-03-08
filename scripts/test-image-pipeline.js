/**
 * Image Processing Test Script
 * 
 * Downloads an image and generates derivatives using Cloudflare Images
 * or stores original in R2 for Worker to resize on-demand.
 * 
 * For now, we'll test with a sample image from Unsplash.
 */

const R2_API = 'https://api.cloudflare.com/client/v4/accounts/3ec62f93675c404fe4a9a4949e38e5e5/r2/buckets/wildphoto-storage/objects';

// Test image from Unsplash
const TEST_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=2400',
    slug: 'scarlet-macaw',
    title: 'Scarlet Macaw',
  },
  {
    url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=2400',
    slug: 'quetzal', 
    title: 'Resplendent Quetzal',
  },
];

async function uploadToR2(key: string, imageUrl: string) {
  console.log(`Uploading ${key}...`);
  
  // Download image
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  
  // Upload to R2 via API
  const result = await fetch(`${R2_API}/${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'image/jpeg',
      'Content-Length': buffer.byteLength.toString(),
    },
    body: buffer,
  });
  
  if (!result.ok) {
    const error = await result.text();
    throw new Error(`Upload failed: ${result.status} ${error}`);
  }
  
  console.log(`✅ Uploaded: ${key}`);
  return buffer.byteLength;
}

async function testImagePipeline() {
  console.log('🧪 Testing Image Processing Pipeline\n');
  
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    console.error('❌ CLOUDFLARE_API_TOKEN not set');
    process.exit(1);
  }
  
  for (const testImage of TEST_IMAGES) {
    console.log(`\n📷 Processing: ${testImage.title}`);
    console.log(`   URL: ${testImage.url}`);
    
    // Upload original
    const originalKey = `originals/${testImage.slug}.jpg`;
    await uploadToR2(originalKey, testImage.url);
    
    // Note: Real derivative generation would require:
    // 1. Cloudflare Images (paid), or
    // 2. Sharp locally + upload, or
    // 3. Worker on-demand resizing
    
    console.log(`   Original: ✅ uploaded`);
    console.log(`   Derivatives: (would be generated in production)`);
  }
  
  console.log('\n✅ Test complete!');
  console.log('\nNote: Full derivative generation requires:');
  console.log('  - Sharp for local resizing, or');
  console.log('  - Cloudflare Images service, or');
  console.log('  - Worker-based on-demand resizing');
}

testImagePipeline().catch(console.error);
