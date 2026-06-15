const https = require('https');

const TS_HOST = 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TS_KEY = 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TS_HOST,
      port: 443,
      path: path,
      method: method,
      headers: {
        'X-Typesense-Api-Key': TS_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // First, get a real document from TS that's already there
  const search = await makeRequest('GET', '/collections/photos/documents/search?q=*&limit=1');
  const existingDoc = search.hits?.[0]?.document;
  console.log('Existing doc fields:', Object.keys(existingDoc || {}));
  console.log('Existing doc id type:', typeof existingDoc?.id, existingDoc?.id);
  
  // Try to add a new document as a test
  const testDoc = {
    id: '999999999',
    title: 'Test Photo',
    slug: 'test-photo',
    description: 'Test description',
    thumb_url: 'https://wildphoto-storage.s3.amazonaws.com/test_thumb.jpg',
    location: 'Costa Rica',
    camera_model: '',
    date_taken: 0,
    keywords: [],
    gallery_slug: 'test',
    seo_title: 'Test Photo',
    meta_description: 'Test',
    og_image_url: '',
    status: 'draft',
    width: 0,
    height: 0,
    lat: 0,
    lon: 0,
    species_common_name: '',
    species_scientific_name: '',
    subjects: [],
    popularity: 0
  };
  
  // Try a single upsert
  try {
    const result = await makeRequest('POST', '/collections/photos/documents', testDoc);
    console.log('Single doc result:', JSON.stringify(result));
  } catch(e) {
    console.error('Single doc error:', e.message);
  }
  
  // Try batch import with just 1 doc
  const result = await makeRequest('POST', '/collections/photos/documents/import', {
    action: 'upsert',
    documents: [testDoc]
  });
  console.log('Batch import result:', JSON.stringify(result));
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });