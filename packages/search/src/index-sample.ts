#!/usr/bin/env npx ts-node
import { typesenseAdmin, PHOTOS_COLLECTION } from '../src/client';

// Sample photos to index
const samplePhotos = [
  {
    id: '1',
    slug: 'scarlet-macaw',
    title: 'Scarlet Macaw',
    description: 'A stunning Scarlet Macaw photographed in Carara, Costa Rica.',
    thumb_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400',
    small_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    medium_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200',
    large_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600',
    original_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3',
    keywords: ['scarlet macaw', 'macaw', 'parrot', 'tropical bird', 'Costa Rica', 'wildlife', 'nature'],
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
    description: 'The legendary Resplendent Quetzal in Costa Rica\'s cloud forests.',
    thumb_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400',
    small_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=800',
    medium_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1200',
    large_url: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1600',
    original_url: 'https://images.unsplash.com/photo-1555169062-013468b47731',
    keywords: ['quetzal', 'resplendent quetzal', 'cloud forest', 'bird', 'Costa Rica', 'rare'],
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
    thumb_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400',
    small_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=800',
    medium_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1200',
    large_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1600',
    original_url: 'https://images.unsplash.com/photo-1549608276-5786777e6587',
    keywords: ['toucan', 'tropical bird', 'Costa Rica', 'bird'],
    gallery: 'birds',
    gallery_id: '1',
    location: 'Manuel Antonio, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Canon EOS R5',
    lens: 'RF 100-500mm f/4.5-7.1L',
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
    thumb_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400',
    small_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=800',
    medium_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1200',
    large_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1600',
    original_url: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4',
    keywords: ['sloth', 'mammal', 'wildlife', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'Manuel Antonio, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Sony A1',
    lens: 'FE 70-200mm f/2.8 GM',
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
    description: 'A Capuchin Monkey in the Costa Rican jungle.',
    thumb_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400',
    small_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=800',
    medium_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1200',
    large_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1600',
    original_url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9',
    keywords: ['monkey', 'primate', 'wildlife', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'Corcovado National Park, Costa Rica',
    orientation: 'landscape',
    camera_model: 'Canon EOS R5',
    lens: 'RF 100-500mm f/4.5-7.1L',
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
    description: 'A Green Iguana basking in the Costa Rican sun.',
    thumb_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400',
    small_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800',
    medium_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1200',
    large_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1600',
    original_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62',
    keywords: ['iguana', 'reptile', 'tropical', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'Tortuguero, Costa Rica',
    orientation: 'landscape',
    camera_model: 'Sony A1',
    lens: 'FE 90mm f/2.8 Macro',
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
    description: 'The stunning Blue Morpho butterfly.',
    thumb_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400',
    small_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=800',
    medium_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1200',
    large_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1600',
    original_url: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890',
    keywords: ['butterfly', 'morpho', 'insect', 'Costa Rica'],
    gallery: 'wildlife',
    gallery_id: '2',
    location: 'La Selva Biological Station, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Canon EOS R5',
    lens: 'RF 100mm f/2.8L Macro',
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
    description: 'A Spectacled Owl resting in the cloud forest.',
    thumb_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=400',
    small_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=800',
    medium_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=1200',
    large_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=1600',
    original_url: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf',
    keywords: ['owl', 'bird', 'nocturnal', 'Costa Rica'],
    gallery: 'birds',
    gallery_id: '1',
    location: 'Monteverde, Costa Rica',
    orientation: 'portrait',
    camera_model: 'Sony A1',
    lens: 'FE 600mm f/4 GM',
    taken_year: 2024,
    taken_month: 3,
    date_taken: new Date('2024-03-28').getTime() * 1000,
    date_uploaded: Date.now() * 1000,
    popularity: 88,
    width: 5760,
    height: 8640,
  },
];

async function indexPhotos() {
  console.log('Indexing sample photos into Typesense...');
  
  try {
    // Import documents
    const result = await typesenseAdmin
      .collections(PHOTOS_COLLECTION)
      .documents()
      .import(samplePhotos, { action: 'emplace' });
    
    console.log('Import result:', result);
    
    // Check for errors
    const errors = result.filter((r: any) => r.success === false);
    if (errors.length > 0) {
      console.error('Import errors:', errors);
    } else {
      console.log(`Successfully indexed ${result.length} photos!`);
    }
    
    return result;
  } catch (error) {
    console.error('Error indexing photos:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  indexPhotos()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed:', err);
      process.exit(1);
    });
}

export { indexPhotos };
