/**
 * Add Test Image to Typesense
 * 
 * Adds the test image with derivative URLs to Typesense
 */

const { Client } = require('typesense');

const typesense = new Client({
  nodes: [{
    host: 'uibn03zvateqwdx2p-1.a1.typesense.net',
    port: 443,
    protocol: 'https',
  }],
  apiKey: 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7',
});

const MEDIA_BASE_URL = 'https://wildphotography-media.josh-ec6.workers.dev';

const testPhoto = {
  id: 'test-1',
  slug: 'scarlet-macaw-test',
  title: 'Scarlet Macaw (Test)',
  description: 'Test image from image processing pipeline.',
  
  // R2 keys
  original_r2_key: 'originals/scarlet-macaw-test.jpg',
  
  // Public derivative URLs
  thumb_url: `${MEDIA_BASE_URL}/derivatives/thumbs/scarlet-macaw-test-thumb.jpg`,
  small_url: `${MEDIA_BASE_URL}/derivatives/small/scarlet-macaw-test-small.jpg`,
  medium_url: `${MEDIA_BASE_URL}/derivatives/medium/scarlet-macaw-test-medium.jpg`,
  large_url: `${MEDIA_BASE_URL}/derivatives/large/scarlet-macaw-test-large.jpg`,
  preview_url: `${MEDIA_BASE_URL}/derivatives/preview/scarlet-macaw-test-preview.jpg`,
  
  // Metadata
  keywords: ['scarlet macaw', 'test', 'pipeline'],
  gallery: 'birds',
  gallery_id: '1',
  location: 'Carara National Park, Costa Rica',
  orientation: 'landscape',
  camera_model: 'Canon EOS R5',
  lens: 'RF 100-500mm f/4.5-7.1L',
  taken_year: 2024,
  taken_month: 3,
  date_taken: new Date('2024-03-15').getTime() * 1000,
  date_uploaded: Date.now() * 1000,
  popularity: 50,
  width: 8192,
  height: 5464,
};

async function addTestImage() {
  console.log('Adding test image to Typesense...\n');
  
  try {
    const result = await typesense
      .collections('photos')
      .documents()
      .upsert(testPhoto);
    
    console.log('✅ Test image added to Typesense!');
    console.log('\nDocument:', JSON.stringify(result, null, 2));
    
    // Test search
    console.log('\n--- Testing Search ---');
    const search = await typesense
      .collections('photos')
      .documents()
      .search({
        q: 'scarlet macaw test',
        query_by: 'title,description,keywords',
      });
    
    console.log(`Found ${search.found} results`);
    if (search.hits && search.hits.length > 0) {
      console.log('\nFirst result:');
      console.log(`  Title: ${search.hits[0].document.title}`);
      console.log(`  Thumb URL: ${search.hits[0].document.thumb_url}`);
      console.log(`  Original R2 Key: ${search.hits[0].document.original_r2_key}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addTestImage();
