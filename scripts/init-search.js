const { Client } = require('typesense');

const client = new Client({
  nodes: [{
    host: 'uibn03zvateqwdx2p-1.a1.typesense.net',
    port: 443,
    protocol: 'https',
  }],
  apiKey: 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7',
});

const photosSchema = {
  name: 'photos',
  fields: [
    { name: 'id', type: 'string', facet: false },
    { name: 'slug', type: 'string', facet: false },
    { name: 'title', type: 'string', facet: false },
    { name: 'description', type: 'string', facet: false, optional: true },
    { name: 'thumb_url', type: 'string', facet: false, optional: true },
    { name: 'small_url', type: 'string', facet: false, optional: true },
    { name: 'medium_url', type: 'string', facet: false, optional: true },
    { name: 'large_url', type: 'string', facet: false, optional: true },
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

async function init() {
  console.log('Creating Typesense photos collection...');
  
  try {
    // Delete existing collection if it exists
    try {
      await client.collections('photos').delete();
      console.log('Deleted existing collection');
    } catch (e) {
      // Collection doesn't exist, that's fine
    }
    
    // Create collection
    const result = await client.collections().create(photosSchema);
    console.log('Collection created:', result.name);
    
    // Index sample photos
    const samplePhotos = [
      {
        id: '1', slug: 'scarlet-macaw', title: 'Scarlet Macaw',
        description: 'A stunning Scarlet Macaw photographed in Carara, Costa Rica.',
        thumb_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400',
        small_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
        medium_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200',
        large_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600',
        keywords: ['scarlet macaw', 'macaw', 'parrot', 'tropical bird', 'Costa Rica', 'wildlife'],
        gallery: 'birds', gallery_id: '1',
        location: 'Carara National Park, Costa Rica',
        orientation: 'landscape',
        camera_model: 'Canon EOS R5',
        lens: 'RF 100-500mm f/4.5-7.1L',
        taken_year: 2024, taken_month: 3,
        date_taken: new Date('2024-03-15').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 100, width: 8192, height: 5464,
      },
      {
        id: '2', slug: 'quetzal', title: 'Resplendent Quetzal',
        description: 'The legendary Resplendent Quetzal in Costa Rica cloud forests.',
        thumb_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400',
        small_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=800',
        medium_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1200',
        large_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1600',
        keywords: ['quetzal', 'resplendent quetzal', 'cloud forest', 'bird', 'Costa Rica'],
        gallery: 'birds', gallery_id: '1',
        location: 'Monteverde Cloud Forest, Costa Rica',
        orientation: 'portrait',
        camera_model: 'Sony A1',
        lens: 'FE 200-600mm f/5.6-6.3 G',
        taken_year: 2024, taken_month: 4,
        date_taken: new Date('2024-04-20').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 95, width: 5760, height: 8640,
      },
      {
        id: '3', slug: 'toucan', title: 'Keel-billed Toucan',
        description: 'The colorful Keel-billed Toucan of Costa Rica.',
        thumb_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400',
        small_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=800',
        medium_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1200',
        large_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1600',
        keywords: ['toucan', 'tropical bird', 'Costa Rica'],
        gallery: 'birds', gallery_id: '1',
        location: 'Manuel Antonio, Costa Rica',
        orientation: 'portrait',
        camera_model: 'Canon EOS R5',
        taken_year: 2024, taken_month: 2,
        date_taken: new Date('2024-02-10').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 85, width: 5760, height: 8640,
      },
      {
        id: '4', slug: 'sloth', title: 'Three-toed Sloth',
        description: 'A peaceful sloth in the Costa Rican rainforest.',
        thumb_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400',
        small_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=800',
        medium_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1200',
        large_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1600',
        keywords: ['sloth', 'mammal', 'wildlife', 'Costa Rica'],
        gallery: 'wildlife', gallery_id: '2',
        location: 'Manuel Antonio, Costa Rica',
        orientation: 'portrait',
        camera_model: 'Sony A1',
        taken_year: 2024, taken_month: 1,
        date_taken: new Date('2024-01-05').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 90, width: 5760, height: 8640,
      },
      {
        id: '5', slug: 'monkey', title: 'Capuchin Monkey',
        thumb_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400',
        small_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=800',
        medium_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1200',
        keywords: ['monkey', 'primate', 'wildlife', 'Costa Rica'],
        gallery: 'wildlife', gallery_id: '2',
        location: 'Corcovado National Park, Costa Rica',
        orientation: 'landscape',
        camera_model: 'Canon EOS R5',
        taken_year: 2024, taken_month: 5,
        date_taken: new Date('2024-05-12').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 75, width: 8192, height: 5464,
      },
      {
        id: '6', slug: 'iguana', title: 'Green Iguana',
        thumb_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400',
        small_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800',
        medium_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1200',
        keywords: ['iguana', 'reptile', 'tropical', 'Costa Rica'],
        gallery: 'wildlife', gallery_id: '2',
        location: 'Tortuguero, Costa Rica',
        orientation: 'landscape',
        camera_model: 'Sony A1',
        taken_year: 2023, taken_month: 11,
        date_taken: new Date('2023-11-08').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 70, width: 8192, height: 5464,
      },
      {
        id: '7', slug: 'butterfly', title: 'Blue Morpho',
        thumb_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400',
        small_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=800',
        medium_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1200',
        keywords: ['butterfly', 'morpho', 'insect', 'Costa Rica'],
        gallery: 'wildlife', gallery_id: '2',
        location: 'La Selva Biological Station, Costa Rica',
        orientation: 'portrait',
        camera_model: 'Canon EOS R5',
        taken_year: 2024, taken_month: 6,
        date_taken: new Date('2024-06-15').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 80, width: 5760, height: 8640,
      },
      {
        id: '8', slug: 'owl', title: 'Spectacled Owl',
        thumb_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=400',
        small_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=800',
        medium_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=1200',
        keywords: ['owl', 'bird', 'nocturnal', 'Costa Rica'],
        gallery: 'birds', gallery_id: '1',
        location: 'Monteverde, Costa Rica',
        orientation: 'portrait',
        camera_model: 'Sony A1',
        taken_year: 2024, taken_month: 3,
        date_taken: new Date('2024-03-28').getTime() * 1000,
        date_uploaded: Date.now() * 1000,
        popularity: 88, width: 5760, height: 8640,
      },
    ];
    
    const importResult = await client.collections('photos').documents().import(samplePhotos, { action: 'emplace' });
    console.log('Indexed', importResult.length, 'photos');
    console.log('All successful:', importResult.every((r) => r.success));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

init();
