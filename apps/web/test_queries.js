const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function test() {
  try {
    // Test article query
    const start1 = Date.now();
    const articles = await sql(`
      SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt, ca.status,
             p.slug as photo_slug, p.thumb_url, ca.metadata
      FROM content_articles ca
      LEFT JOIN photos p ON p.id = ca.featured_photo_id
      WHERE ca.status = 'published'
      ORDER BY ca.published_at DESC NULLS LAST
    `);
    console.log('Articles:', articles.length, 'in', Date.now() - start1, 'ms');

    // Test region query
    const start2 = Date.now();
    const regions = await sql(`
      SELECT p.region, COUNT(*) as cnt, MAX(p.thumb_url) as thumb
      FROM photos p
      WHERE region IS NOT NULL AND region != ''
        AND is_active = true AND ready_for_public_render = true
        AND thumb_url IS NOT NULL
      GROUP BY region
      HAVING COUNT(*) >= 5
      ORDER BY COUNT(*) DESC
    `);
    console.log('Regions:', regions.length, 'in', Date.now() - start2, 'ms');

    // Test homepage query (galleries + recent photos + random + popular + species)
    const start3 = Date.now();
    const [galleries, recentPhotos, species] = await Promise.all([
      sql(`SELECT g.id, g.slug, g.name, COUNT(gp.photo_id) as cnt FROM galleries g LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id WHERE g.is_active = true GROUP BY g.id ORDER BY g.name LIMIT 8`),
      sql(`SELECT p.id, p.slug, p.title, p.thumb_url FROM photos p WHERE is_active = true AND ready_for_public_render = true AND thumb_url IS NOT NULL ORDER BY date_uploaded DESC LIMIT 8`),
      sql(`SELECT species_common_name, COUNT(*) as cnt FROM photos WHERE species_common_name IS NOT NULL AND species_common_name != '' AND is_active = true AND ready_for_public_render = true AND thumb_url IS NOT NULL GROUP BY species_common_name ORDER BY COUNT(*) DESC LIMIT 12`),
    ]);
    console.log('Galleries:', galleries.length, '| Recent:', recentPhotos.length, '| Species:', species.length, 'in', Date.now() - start3, 'ms');

  } catch(e) { 
    console.error('ERROR:', e.message); 
  }
}
test();