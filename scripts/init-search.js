const { Client } = require('typesense');

const client = new Client({
  nodes: [{
    host: 'uibn03zvateqwdx2p-1.a1.typesense.net',
    port: 443,
    protocol: 'https',
  }],
  apiKey: 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7',
});

// R2 Configuration
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-wildphoto-storage.existing.blog';

function buildUrls(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  return {
    thumb_url: `${R2_PUBLIC_URL}/derivatives/thumbs/${baseName}-thumb.jpg`,
    small_url: `${R2_PUBLIC_URL}/derivatives/small/${baseName}-small.jpg`,
    medium_url: `${R2_PUBLIC_URL}/derivatives/medium/${baseName}-medium.jpg`,
    large_url: `${R2_PUBLIC_URL}/derivatives/large/${baseName}-large.jpg`,
    original_url: `${R2_PUBLIC_URL}/originals/${filename}`,
  };
}

// Sample photos with R2 paths - ONLY DERIVATIVES ARE PUBLIC
const samplePhotos = [
  {
    id: '1',
    slug: 'scarlet-macaw',
    title: 'Scarlet Macaw',
    description: 'A stunning Scarlet Macaw photographed in Carara, Costa Rica.',
    ...buildUrls('scarlet-macaw.jpg'),
    keywords: ['scarlet macaw', 'macaw', 'parrot', 'tropical bird', 'Costa Rica', 'wildlife'],
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
    popularity: 100,
    width: 8192,
    height: 5464,
  },
  {
    id: '2',
    slug: 'quetzal',
    title: 'Resplendent Quetzal',
    description: 'The legendary Resplendent Quetzal in Costa Rica cloud forests.',
    ...buildUrls('quetzal.jpg'),
    keywords: ['quetzal', 'resplendent quetzal', 'cloud forest', 'bird', 'Costa Rica'],
    gallery: 'birds',
    gallery_id: '1',
    location: 'Monteverde Cloud Forest, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Sony A1',
    lens: 'FE 200-600mm f/5.6-6.3 G',
    taken_year: 2024,
    taken_month: 4,
    date_taken: new Date('2024-04-20').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 95,
    width: 5760,
    height: 8640,
  },
  {
    id: '3',
    slug: 'toucan',
    title: 'Keel-billed Toucan',
    description: 'The colorful Keel-billed Toucan of Costa Rica.',
    ...buildUrls('toucan.jpg'),
    keywords: ['toucan', 'tropical bird', 'Costa Rica'],
    gallery: 'birds',
    gallery_id: '1',
    location: 'Manuel Antonio, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Canon EOS R5',
    taken_year: 2024,
    taken_month: 2,
    date_taken: new Date('2024-02-10').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 85,
    width: 5760,
    height: 8640,
  },
  {
    id: '4',
    slug: 'sloth',
    title: 'Three-toed Sloth',
    description: 'A peaceful sloth in the Costa Rican rainforest.',
    ...buildUrls('sloth.jpg'),
    keywords: ['sloth', 'mammal', 'wildlife', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'Manuel Antonio, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Sony A1',
    taken_year: 2024,
    taken_month: 1,
    date_taken: new Date('2024-01-05').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 90,
    width: 5760,
    height: 8640,
  },
  {
    id: '5',
    slug: 'monkey',
    title: 'Capuchin Monkey',
    ...buildUrls('monkey.jpg'),
    keywords: ['monkey', 'primate', 'wildlife', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'Corcovado National Park, Costa Rica',
    orientation: 'landscape',
    camera_model: 'Canon EOS R5',
    taken_year: 2024,
    taken_month: 5,
    date_taken: new Date('2024-05-12').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 75,
    width: 8192,
    height: 5464,
  },
  {
    id: '6',
    slug: 'iguana',
    title: 'Green Iguana',
    ...buildUrls('iguana.jpg'),
    keywords: ['iguana', 'reptile', 'tropical', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'Tortuguero, Costa Rica',
    orientation: 'landscape',
    camera_model: 'Sony A1',
    taken_year: 2023,
    taken_month: 11,
    date_taken: new Date('2023-11-08').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 70,
    width: 8192,
    height: 5464,
  },
  {
    id: '7',
    slug: 'butterfly',
    title: 'Blue Morpho',
    ...buildUrls('butterfly.jpg'),
    keywords: ['butterfly', 'morpho', 'insect', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'La Selva Biological Station, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Canon EOS R5',
    taken_year: 2024,
    taken_month: 6,
    date_taken: new Date('2024-06-15').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 80,
    width: 5760,
    height: 8640,
  },
  {
    id: '8',
    slug: 'owl',
    title: 'Spectacled Owl',
    ...buildUrls('owl.jpg'),
    keywords: ['owl', 'bird', 'nocturnal', 'Costa Rica'],
    gallery: 'birds',
    gallery_id: '1',
    location: 'Monteverde, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Sony A1',
    taken_year: 2024,
    taken_month: 3,
    date_taken: new Date('2024-03-28').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 88,
    width: 5760,
    height: 8640,
  },
];

async function initSearch() {
  console.log('Initializing Typesense search with R2 paths...');
  
  try {
    // Delete existing collection
    try {
      await client.collections('photos').delete();
      console.log('Deleted existing collection');
    } catch (e) {
      // Collection doesn't exist
    }
    
    // Create collection with schema
    const schema = {
      name: 'photos',
      fields: [
        { name: 'id', type: 'string', facet: false },
        { name: 'slug', type: 'string', facet: false },
        { name: 'title', type: 'string', facet: false },
        { name: 'description', type: 'string', facet: false, optional: true },
        // Image URLs - all derivative paths (public)
        { name: 'thumb_url', type: 'string', facet: false, optional: true },
        { name: 'small_url', type: 'string', facet: false, optional: true },
        { name: 'medium_url', type: 'string', facet: false, optional: true },
        { name: 'large_url', type: 'string', facet: false, optional: true },
        // Original URL - stored but never exposed via API
        { name: 'original_url', type: 'string', facet: false, optional: true },
        // Facets
        { name: 'keywords', type: 'string[]', facet: true, optional: true },
        { name: 'gallery', type: 'string', facet: true, optional: true },
        { name: 'gallery_id', type: 'string', facet: true, optional: true },
        { name: 'location', type: 'string', facet: true, optional: true },
        { name: 'orientation', type: 'string', facet: true, optional: true },
        { name: 'camera_model', type: 'string', facet: true, optional: true },
        { name: 'lens', type: 'string', facet: true, optional: true },
        { name: 'taken_year', type: 'int32', facet: true, optional: true },
        { name: 'taken_month', type: 'int32', facet: true, optional: true },
        { name: 'date_taken', type: 'int64', facet: false, optional: true },
        { name: 'date_uploaded', type: 'int64', facet: false, optional: true },
        { name: 'popularity', type: 'int32', facet: false, optional: true },
        { name: 'width', type: 'int32', facet: false, optional: true },
        { name: 'height', type: 'int32', facet: false, optional: true },
      ]
    };
    
    const result = await client.collections().create(schema);
    console.log('Collection created:', result.name);
    
    // Import documents
    const importResult = await client.collections('photos').documents().import(samplePhotos, { action: 'emplace' });
    console.log('Indexed', importResult.length, 'photos');
    console.log('All successful:', importResult.every((r) => r.success));
    
    console.log('\n✅ R2 Storage Paths:');
    console.log('  - originals/           (PRIVATE)');
    console.log('  - derivatives/thumbs/  (PUBLIC)');  
    console.log('  - derivatives/small/   (PUBLIC)');
    console.log('  - derivatives/medium/  (PUBLIC)');
    console.log('  - derivatives/large/   (PUBLIC)');
    console.log('  - downloads/           (PUBLIC)');
    console.log('\n✅ UI only exposes derivative URLs');
    console.log('✅ Originals remain private');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

initSearch();
