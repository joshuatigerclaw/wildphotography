/**
 * Seed Database Script - Simplified
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const sql = neon(DATABASE_URL);

const MEDIA_BASE = 'https://wildphotography-media.josh-ec6.workers.dev';

const galleries = [
  { name: 'Birds of Costa Rica', slug: 'birds', description: 'Stunning photographs of Costa Rica\'s incredible avian diversity.' },
  { name: 'Wildlife', slug: 'wildlife', description: 'Mammals, reptiles, and more from Costa Rica.' },
  { name: 'Landscapes', slug: 'landscapes', description: 'Breathtaking landscapes from volcanic peaks to pristine beaches.' },
  { name: 'Rainforests', slug: 'rainforests', description: 'The lush beauty of Costa Rica\'s tropical rainforests.' },
];

const photos = [
  { title: 'Scarlet Macaw', slug: 'scarlet-macaw', description: 'A stunning Scarlet Macaw photographed in Carara, Costa Rica.', gallery: 'birds', location: 'Carara National Park, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', keywords: ['scarlet macaw', 'macaw', 'parrot', 'tropical bird', 'Costa Rica'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 3 },
  { title: 'Resplendent Quetzal', slug: 'quetzal', description: 'The legendary Resplendent Quetzal in Costa Rica\'s cloud forests.', gallery: 'birds', location: 'Monteverde Cloud Forest, Costa Rica', camera: 'Sony A1', lens: 'FE 200-600mm', keywords: ['quetzal', 'resplendent quetzal', 'cloud forest', 'bird', 'Costa Rica'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 4 },
  { title: 'Keel-billed Toucan', slug: 'keel-billed-toucan', description: 'The colorful Keel-billed Toucan of Costa Rica.', gallery: 'birds', location: 'Manuel Antonio, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', keywords: ['toucan', 'tropical bird', 'Costa Rica'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 2 },
  { title: 'Three-toed Sloth', slug: 'three-toed-sloth', description: 'A peaceful sloth in the Costa Rican rainforest.', gallery: 'wildlife', location: 'Manuel Antonio, Costa Rica', camera: 'Sony A1', lens: 'FE 70-200mm', keywords: ['sloth', 'mammal', 'wildlife', 'Costa Rica'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 1 },
  { title: 'Capuchin Monkey', slug: 'capuchin-monkey', description: 'A Capuchin Monkey in the Costa Rican jungle.', gallery: 'wildlife', location: 'Corcovado National Park, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', keywords: ['monkey', 'primate', 'wildlife', 'Costa Rica'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 5 },
  { title: 'Green Iguana', slug: 'green-iguana', description: 'A Green Iguana basking in the Costa Rican sun.', gallery: 'wildlife', location: 'Tortuguero, Costa Rica', camera: 'Sony A1', lens: 'FE 90mm Macro', keywords: ['iguana', 'reptile', 'tropical', 'Costa Rica'], width: 8192, height: 5464, orientation: 'landscape', year: 2023, month: 11 },
  { title: 'Blue Morpho', slug: 'blue-morpho', description: 'The stunning Blue Morpho butterfly.', gallery: 'wildlife', location: 'La Selva Biological Station, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100mm Macro', keywords: ['butterfly', 'morpho', 'insect', 'Costa Rica'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 6 },
  { title: 'Spectacled Owl', slug: 'spectacled-owl', description: 'A Spectacled Owl resting in the cloud forest.', gallery: 'birds', location: 'Monteverde, Costa Rica', camera: 'Sony A1', lens: 'FE 600mm', keywords: ['owl', 'bird', 'nocturnal', 'Costa Rica'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 3 },
  { title: 'Toucan Barbet', slug: 'toucan-barbet', description: 'The Toucan Barbet with its colorful plumage.', gallery: 'birds', location: 'Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', keywords: ['toucan', 'barbet', 'bird'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 7 },
  { title: 'Rufous Hummingbird', slug: 'rufous-hummingbird', description: 'A Rufous-tailed Hummingbird feeding on nectar.', gallery: 'birds', location: 'Costa Rica', camera: 'Sony A1', lens: 'FE 200-600mm', keywords: ['hummingbird', 'bird', 'tiny'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 4 },
  { title: 'White-throated Magpie-Jay', slug: 'magpie-jay', description: 'The striking White-throated Magpie-Jay.', gallery: 'birds', location: 'Guanacaste, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', keywords: ['magpie-jay', 'jay', 'bird'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 2 },
  { title: 'Collared Aracari', slug: 'collared-aracari', description: 'A Collared Aracari in the tropical forest.', gallery: 'birds', location: 'Arenal, Costa Rica', camera: 'Sony A1', lens: 'FE 200-600mm', keywords: ['aracari', 'toucan', 'bird'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 5 },
  { title: 'Green Honeycreeper', slug: 'green-honeycreeper', description: 'The vibrant Green Honeycreeper.', gallery: 'birds', location: 'Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', keywords: ['honeycreeper', 'bird', 'tropical'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 6 },
  { title: 'Boat-billed Heron', slug: 'boat-billed-heron', description: 'The unique Boat-billed Heron.', gallery: 'birds', location: 'Tortuguero, Costa Rica', camera: 'Sony A1', lens: 'FE 200-600mm', keywords: ['heron', 'bird', 'wetland'], width: 8192, height: 5464, orientation: 'landscape', year: 2023, month: 12 },
  { title: 'Fiery-throated Hummingbird', slug: 'fiery-hummingbird', description: 'The iridescent Fiery-throated Hummingbird.', gallery: 'birds', location: 'Monteverde, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100mm Macro', keywords: ['hummingbird', 'bird', 'cloud forest'], width: 5760, height: 8640, orientation: 'portrait', year: 2024, month: 4 },
  { title: 'Montezuma Oropendola', slug: 'montezuma-oropendola', description: 'The Montezuma Oropendola with its distinctive nest.', gallery: 'birds', location: 'Carara, Costa Rica', camera: 'Sony A1', lens: 'FE 200-600mm', keywords: ['oropendola', 'bird', 'tropical'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 3 },
  { title: 'Volcano View', slug: 'volcano-view', description: 'Aerial view of Costa Rica\'s volcanic landscape.', gallery: 'landscapes', location: 'Arenal Volcano, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 24-70mm', keywords: ['volcano', 'landscape', 'aerial', 'Costa Rica'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 1 },
  { title: 'Pacific Sunset', slug: 'pacific-sunset', description: 'Golden sunset over the Pacific Ocean.', gallery: 'landscapes', location: 'Pacific Coast, Costa Rica', camera: 'Sony A1', lens: 'FE 16-35mm', keywords: ['sunset', 'beach', 'ocean', 'landscape'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 2 },
  { title: 'Cloud Forest Mist', slug: 'cloud-forest-mist', description: 'Morning mist in the Monteverde cloud forest.', gallery: 'rainforests', location: 'Monteverde, Costa Rica', camera: 'Canon EOS R5', lens: 'RF 24-70mm', keywords: ['cloud forest', 'mist', 'fog', 'rainforest'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 5 },
  { title: 'Rainforest Waterfall', slug: 'rainforest-waterfall', description: 'A hidden waterfall in the tropical rainforest.', gallery: 'rainforests', location: 'Rio Celeste, Costa Rica', camera: 'Sony A1', lens: 'FE 16-35mm', keywords: ['waterfall', 'rainforest', 'river', 'nature'], width: 8192, height: 5464, orientation: 'landscape', year: 2024, month: 6 },
];

function buildUrls(slug) {
  return {
    thumb_url: `${MEDIA_BASE}/derivatives/thumbs/${slug}-thumb.jpg`,
    small_url: `${MEDIA_BASE}/derivatives/small/${slug}-small.jpg`,
    medium_url: `${MEDIA_BASE}/derivatives/medium/${slug}-medium.jpg`,
    large_url: `${MEDIA_BASE}/derivatives/large/${slug}-large.jpg`,
    preview_url: `${MEDIA_BASE}/derivatives/preview/${slug}-preview.jpg`,
  };
}

async function seed() {
  console.log('🌱 Seeding database...\n');

  await sql('DELETE FROM gallery_photos');
  await sql('DELETE FROM photo_keywords');
  await sql('DELETE FROM photos');
  await sql('DELETE FROM keywords');
  await sql('DELETE FROM galleries');
  console.log('Cleared existing data.');

  for (const g of galleries) {
    await sql('INSERT INTO galleries (name, slug, description) VALUES ($1, $2, $3)', [g.name, g.slug, g.description]);
  }
  console.log(`Inserted ${galleries.length} galleries.`);

  const galleryRows = await sql('SELECT id, slug FROM galleries');
  const galleryMap = {};
  for (const row of galleryRows) galleryMap[row.slug] = row.id;

  for (const photo of photos) {
    const urls = buildUrls(photo.slug);
    const result = await sql(
      `INSERT INTO photos (title, slug, description, location, camera_model, lens, width, height, orientation, popularity, is_active, thumb_url, small_url, medium_url, large_url, preview_url, date_taken) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $13, $14, $15, $16) RETURNING id`,
      [photo.title, photo.slug, photo.description, photo.location, photo.camera, photo.lens, photo.width, photo.height, photo.orientation, Math.floor(Math.random() * 50) + 50, urls.thumb_url, urls.small_url, urls.medium_url, urls.large_url, urls.preview_url, new Date(`${photo.year}-${photo.month}-15`)]
    );
    const photoId = result[0].id;

    for (const kw of photo.keywords) {
      const slug = kw.toLowerCase().replace(/\s+/g, '-');
      try { await sql('INSERT INTO keywords (name, slug, usage_count) VALUES ($1, $2, 1)', [kw, slug]); } catch (e) { /* ignore */ }
      const kwRow = await sql('SELECT id FROM keywords WHERE name = $1', [kw]);
      if (kwRow[0]) await sql('INSERT INTO photo_keywords (photo_id, keyword_id, confidence) VALUES ($1, $2, 1.00)', [photoId, kwRow[0].id]);
    }

    await sql('INSERT INTO gallery_photos (gallery_id, photo_id, sort_order) VALUES ($1, $2, $3)', [galleryMap[photo.gallery], photoId, photos.indexOf(photo)]);
  }
  console.log(`Inserted ${photos.length} photos.`);

  for (const slug in galleryMap) {
    const cover = await sql('SELECT photo_id FROM gallery_photos WHERE gallery_id = $1 ORDER BY sort_order LIMIT 1', [galleryMap[slug]]);
    if (cover[0]) await sql('UPDATE galleries SET cover_photo_id = $1 WHERE id = $2', [cover[0].photo_id, galleryMap[slug]]);
  }

  const counts = await sql(`SELECT (SELECT COUNT(*) FROM galleries) g, (SELECT COUNT(*) FROM photos) p, (SELECT COUNT(*) FROM keywords) k`);
  console.log('\n✅ Seeding complete!');
  console.log(`   Galleries: ${counts[0].g}`);
  console.log(`   Photos: ${counts[0].p}`);
  console.log(`   Keywords: ${counts[0].k}`);
}

seed().catch(console.error);
