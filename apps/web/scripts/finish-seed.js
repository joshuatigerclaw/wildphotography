const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function finish() {
  const photos = await sql`SELECT id, slug FROM photos ORDER BY date_created`;
  const galleries = await sql`SELECT id, slug FROM galleries`;
  const keywords = await sql`SELECT id, slug FROM keywords`;
  
  const birds = galleries.find(g => g.slug === 'birds');
  const wildlife = galleries.find(g => g.slug === 'wildlife');
  const landscapes = galleries.find(g => g.slug === 'landscapes');
  const rainforests = galleries.find(g => g.slug === 'rainforests');
  
  // Clear existing
  await sql`DELETE FROM gallery_photos`;
  await sql`DELETE FROM photo_keywords`;
  
  // Birds (first 5)
  for (let i = 0; i < 5; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${birds.id}, ${photos[i].id}, ${i + 1})`;
  }
  // Wildlife (5-9)
  for (let i = 5; i < 10; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${wildlife.id}, ${photos[i].id}, ${i - 4})`;
  }
  // Landscapes (10-14)
  for (let i = 10; i < 15 && i < photos.length; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${landscapes.id}, ${photos[i].id}, ${i - 9})`;
  }
  // Rainforests (15-18)
  for (let i = 15; i < photos.length; i++) {
    await sql`INSERT INTO gallery_photos (gallery_id, photo_id, position) VALUES (${rainforests.id}, ${photos[i].id}, ${i - 14})`;
  }
  
  const kwMap = {};
  keywords.forEach(k => { kwMap[k.slug] = k.id; });
  
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[0].id}, ${kwMap['scarlet-macaw']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[0].id}, ${kwMap['birds']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[1].id}, ${kwMap['resplendent-quetzal']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[1].id}, ${kwMap['birds']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[2].id}, ${kwMap['toucan']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[5].id}, ${kwMap['sloth']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[5].id}, ${kwMap['wildlife']})`;
  await sql`INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (${photos[6].id}, ${kwMap['monkey']})`;
  
  console.log('Done!', photos.length, 'photos linked to galleries');
}
finish().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
