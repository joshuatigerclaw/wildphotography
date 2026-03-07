const { neon } = require('@neondatabase/serverless');

const sql = neon('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function seed() {
  console.log('Seeding database...');

  // Insert galleries
  const galleriesResult = await sql`
    INSERT INTO galleries (name, slug, description, status)
    VALUES 
      ('Birds of Costa Rica', 'birds', 'Stunning photographs of Costa Rica avian diversity.', 'public'),
      ('Wildlife', 'wildlife', 'Mammals, reptiles, and more from Costa Rica.', 'public'),
      ('Landscapes', 'landscapes', 'Breathtaking landscapes from volcanic peaks to beaches.', 'public'),
      ('Rainforests', 'rainforests', 'The lush beauty of Costa Rica tropical rainforests.', 'public')
    RETURNING id, slug
  `;
  console.log('Inserted galleries:', galleriesResult.length);

  // Insert keywords
  const keywordsResult = await sql`
    INSERT INTO keywords (keyword, slug, keyword_type)
    VALUES 
      ('Scarlet Macaw', 'scarlet-macaw', 'species'),
      ('Resplendent Quetzal', 'resplendent-quetzal', 'species'),
      ('Toucan', 'toucan', 'species'),
      ('Hummingbird', 'hummingbird', 'species'),
      ('Macaw', 'macaw', 'species'),
      ('Wildlife', 'wildlife', 'category'),
      ('Birds', 'birds', 'category'),
      ('Landscape', 'landscape', 'category'),
      ('Costa Rica', 'costa-rica', 'location'),
      ('Rainforest', 'rainforest', 'habitat'),
      ('Cloud Forest', 'cloud-forest', 'habitat'),
      ('Beach', 'beach', 'habitat'),
      ('Sloth', 'sloth', 'species'),
      ('Monkey', 'monkey', 'species'),
      ('Iguana', 'iguana', 'species'),
      ('Butterfly', 'butterfly', 'species'),
      ('Owl', 'owl', 'species'),
      ('Waterfall', 'waterfall', 'landscape'),
      ('Volcano', 'volcano', 'landscape'),
      ('Jaguar', 'jaguar', 'species')
    RETURNING id, slug
  `;
  console.log('Inserted keywords:', keywordsResult.length);

  // Insert photos
  const photosResult = await sql`
    INSERT INTO photos (slug, title, caption_short, description_long, location_name, country, camera_make, camera_model, lens, width, height, price_download, thumb_url, small_url, medium_url, large_url, status)
    VALUES 
      ('scarlet-macaw-flight', 'Scarlet Macaw in Flight', 'A Scarlet Macaw soaring over the rainforest', 'A stunning capture of a Scarlet Macaw flying through the Costa Rican rainforest.', 'Carara National Park', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 8192, 5464, 49.99, 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400', 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=900', 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600', 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=2400', 'public'),
      ('resplendent-quetzal', 'Resplendent Quetzal', 'Male Quetzal in cloud forest', 'The Resplendent Quetzal is one of the most sought-after birds in the world.', 'Monteverde Cloud Forest', 'Costa Rica', 'Canon', 'EOS R5', 'RF 600mm', 6720, 4480, 59.99, 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400', 'https://images.unsplash.com/photo-1555169062-013468b47731?w=900', 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1600', 'https://images.unsplash.com/photo-1555169062-013468b47731?w=2400', 'public'),
      ('keel-billed-toucan', 'Keel-billed Toucan', 'The colorful Keel-billed Toucan', 'The Keel-billed Toucan is known for its spectacular rainbow-colored bill.', 'Manuel Antonio', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 8192, 5464, 39.99, 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400', 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=900', 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1600', 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=2400', 'public'),
      ('fiery-throated-hummingbird', 'Fiery-throated Hummingbird', 'A jewel of the cloud forest', 'The Fiery-throated Hummingbird is found only in Costa Rica and Panama.', 'Monteverde', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 6720, 4480, 34.99, 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400', 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=900', 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1600', 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=2400', 'public'),
      ('great-green-macaw', 'Great Green Macaw', 'The endangered Great Green Macaw', 'The Great Green Macaw is an endangered species found in Costa Rica.', 'Arenal Volcano Area', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 8192, 5464, 54.99, 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400', 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=900', 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600', 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=2400', 'public'),
      ('three-toed-sloth', 'Three-toed Sloth', 'A sloth resting in the trees', 'The Brown-throated Three-toed Sloth is one of Costa Rica most beloved animals.', 'Manuel Antonio', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 6720, 4480, 29.99, 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400', 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=900', 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1600', 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=2400', 'public'),
      ('capuchin-monkey', 'White-throated Capuchin', 'Curious Capuchin monkey', 'The White-throated Capuchin is one of the most intelligent monkeys in Costa Rica.', 'Corcovado National Park', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 8192, 5464, 39.99, 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400', 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=900', 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1600', 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=2400', 'public'),
      ('green-iguana', 'Green Iguana', 'A large Green Iguana basking', 'The Green Iguana is one of the largest lizards in Costa Rica.', 'Tortuguero', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 6720, 4480, 24.99, 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400', 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=900', 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1600', 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=2400', 'public'),
      ('blue-morpho', 'Blue Morpho Butterfly', 'The iconic Blue Morpho', 'The Blue Morpho is one of the most famous butterflies in Costa Rica.', 'La Selva Biological Station', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100mm Macro', 6720, 4480, 19.99, 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400', 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=900', 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1600', 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=2400', 'public'),
      ('spectacled-owl', 'Spectacled Owl', 'The mysterious Spectacled Owl', 'The Spectacled Owl is a striking nocturnal bird found in Costa Rica.', 'Monteverde', 'Costa Rica', 'Canon', 'EOS R5', 'RF 600mm', 6720, 4480, 44.99, 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=400', 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=900', 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=1600', 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=2400', 'public'),
      ('arenal-sunset', 'Arenal Volcano at Sunset', 'Arenal Volcano bathed in golden light', 'The perfect conical shape of Arenal Volcano at sunset.', 'Arenal Volcano', 'Costa Rica', 'Canon', 'EOS R5', 'RF 24-70mm', 8192, 5464, 49.99, 'https://images.unsplash.com/photo-1569514288524-a4fcc3dc0f4c?w=400', 'https://images.unsplash.com/photo-1569514288524-a4fcc3dc0f4c?w=900', 'https://images.unsplash.com/photo-1569514288524-a4fcc3dc0f4c?w=1600', 'https://images.unsplash.com/photo-1569514288524-a4fcc3dc0f4c?w=2400', 'public'),
      ('playa-hermosa', 'Playa Hermosa Beach', 'Pristine Pacific coastline', 'Playa Hermosa on the Pacific coast of Costa Rica.', 'Playa Hermosa', 'Costa Rica', 'Canon', 'EOS R5', 'RF 24-70mm', 8192, 5464, 39.99, 'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=400', 'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=900', 'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=1600', 'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=2400', 'public'),
      ('rio-celeste', 'Rio Celeste Waterfall', 'The stunning turquoise waters', 'Rio Celeste is famous for its brilliant turquoise color.', 'Tenorio Volcano National Park', 'Costa Rica', 'Canon', 'EOS R5', 'RF 24-70mm', 6720, 4480, 44.99, 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400', 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=900', 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1600', 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=2400', 'public'),
      ('monteverde-cloud-forest', 'Monteverde Cloud Forest', 'Misty clouds rolling through the canopy', 'The mysterious cloud forests of Monteverde are home to incredible biodiversity.', 'Monteverde Cloud Forest', 'Costa Rica', 'Canon', 'EOS R5', 'RF 24-70mm', 8192, 5464, 34.99, 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=400', 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=900', 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=1600', 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=2400', 'public'),
      ('rainforest-canopy', 'Rainforest Canopy', 'Looking up at the towering trees', 'Costa Rica rainforests are among the most biodiverse places on Earth.', 'Corcovado National Park', 'Costa Rica', 'Canon', 'EOS R5', 'RF 16-35mm', 8192, 5464, 29.99, 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=400', 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=900', 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=1600', 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=2400', 'public'),
      ('rainforest-stream', 'Tropical Rainforest Stream', 'A peaceful stream in the jungle', 'The sounds of rushing water fill the Costa Rican rainforest.', 'La Selva Biological Station', 'Costa Rica', 'Canon', 'EOS R5', 'RF 24-70mm', 8192, 5464, 24.99, 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=400', 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=900', 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=1600', 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=2400', 'public'),
      ('collared-aracari', 'Collared Aracari', 'A colorful toucan relative', 'The Collared Aracari is a medium-sized toucan found in Costa Rica.', 'Manuel Antonio', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 6720, 4480, 29.99, 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400', 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=900', 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1600', 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=2400', 'public'),
      ('turquoise-browed-motmot', 'Turquoise-browed Motmot', 'The iconic Motmot of Costa Rica', 'The Turquoise-browed Motmot is known for its distinctive racket-shaped tail.', 'Guanacaste', 'Costa Rica', 'Canon', 'EOS R5', 'RF 100-500mm', 6720, 4480, 34.99, 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400', 'https://images.unsplash.com/photo-1555169062-013468b47731?w=900', 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1600', 'https://images.unsplash.com/photo-1555169062-013468b47731?w=2400', 'public')
    RETURNING id, slug
  `;
  console.log('Inserted photos:', photosResult.length);

  // Link photos to galleries
  const birdsGallery = galleriesResult.find(g => g.slug === 'birds');
  const wildlifeGallery = galleriesResult.find(g => g.slug === 'wildlife');
  const landscapesGallery = galleriesResult.find(g => g.slug === 'landscapes');
  const rainforestsGallery = galleriesResult.find(g => g.slug === 'rainforests');

  // Birds (first 5)
  for (let i = 0; i < 5; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${birdsGallery.id}, ${photosResult[i].id}, ${i + 1})`;
  }
  // Wildlife (5-9)
  for (let i = 5; i < 10; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${wildlifeGallery.id}, ${photosResult[i].id}, ${i - 4})`;
  }
  // Landscapes (10-14)
  for (let i = 10; i < 15; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${landscapesGallery.id}, ${photosResult[i].id}, ${i - 9})`;
  }
  // Rainforests (15-19)
  for (let i = 15; i < 20; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${rainforestsGallery.id}, ${photosResult[i].id}, ${i - 14})`;
  }
  console.log('Linked photos to galleries');

  // Link keywords
  const kwMap = {};
  keywordsResult.forEach(k => { kwMap[k.slug] = k.id; });

  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[0].id}, ${kwMap['scarlet-macaw']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[0].id}, ${kwMap['birds']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[1].id}, ${kwMap['resplendent-quetzal']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[1].id}, ${kwMap['birds']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[2].id}, ${kwMap['toucan']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[5].id}, ${kwMap['sloth']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[5].id}, ${kwMap['wildlife']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photosResult[6].id}, ${kwMap['monkey']})`;
  console.log('Linked keywords to photos');

  console.log('\nSeeding complete!');
  console.log('Galleries:', galleriesResult.length);
  console.log('Photos:', photosResult.length);
  console.log('Keywords:', keywordsResult.length);
}

seed().catch(console.error);
