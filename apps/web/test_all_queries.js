const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function test() {
  try {
    // Test getAllArticles
    const start1 = Date.now();
    const articles = await sql(`
      SELECT ca.id, ca.title, ca.slug, ca.article_type, ca.excerpt, ca.status,
             p.slug as photo_slug, p.thumb_url, p.small_url, p.medium_url, p.large_url, ca.metadata
      FROM content_articles ca
      LEFT JOIN photos p ON p.id = ca.featured_photo_id
      WHERE ca.status = 'published'
      ORDER BY ca.published_at DESC NULLS LAST, ca.updated_at DESC
    `);
    console.log('Articles:', articles.length, 'in', Date.now() - start1, 'ms');

    // Test getAllRegions
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

    // Test getAllSpecies
    const start3 = Date.now();
    const species = await sql(`
      SELECT species_common_name as name, species_scientific_name,
             COUNT(*) as cnt, MAX(p.thumb_url) as thumb
      FROM photos p
      WHERE species_common_name IS NOT NULL AND species_common_name != ''
        AND is_active = true AND ready_for_public_render = true
        AND thumb_url IS NOT NULL
      GROUP BY species_common_name, species_scientific_name
      HAVING COUNT(*) >= 1
      ORDER BY COUNT(*) DESC, species_common_name
    `);
    console.log('Species:', species.length, 'in', Date.now() - start3, 'ms');

    // Test homepage queries in parallel
    const start4 = Date.now();
    const [galleries, recentPhotos, randomPhotos, popularPhotos] = await Promise.all([
      sql(`SELECT g.id, g.slug, g.name, COUNT(gp.photo_id) as cnt FROM galleries g LEFT JOIN gallery_photos gp ON g.id = gp.gallery_id WHERE g.is_active = true GROUP BY g.id ORDER BY g.name LIMIT 8`),
      sql(`SELECT p.id, p.slug, p.title, p.thumb_url FROM photos p WHERE is_active = true AND ready_for_public_render = true AND thumb_url IS NOT NULL ORDER BY date_uploaded DESC LIMIT 8`),
      sql(`SELECT p.id, p.slug, p.title, p.thumb_url FROM photos p WHERE is_active = true AND ready_for_public_render = true AND thumb_url IS NOT NULL ORDER BY RANDOM() LIMIT 6`),
      sql(`SELECT p.id, p.slug, p.title, p.thumb_url, p.views_count FROM photos p WHERE is_active = true AND ready_for_public_render = true AND views_count IS NOT NULL AND views_count > 0 AND thumb_url IS NOT NULL ORDER BY p.views_count DESC LIMIT 8`),
    ]);
    console.log('Galleries:', galleries.length, '| Recent:', recentPhotos.length, '| Random:', randomPhotos.length, '| Popular:', popularPhotos.length, 'in', Date.now() - start4, 'ms');

    // Test location page queries
    const start5 = Date.now();
    const loc = await sql(`SELECT id, name, slug, region, location_type, metadata FROM locations WHERE slug = 'tortuguero'`);
    const regionName = loc[0] && loc[0].region;
    const regionLocs = await sql(`SELECT id, name, slug FROM locations WHERE region = $1 AND location_type = 'location'`, [regionName]);
    console.log('Location query + region locations:', Date.now() - start5, 'ms');

    // Test getPhotosByLocation for tortuguero
    const start6 = Date.now();
    const meta = loc[0] && loc[0].metadata;
    const gallerySlugs = [];
    if (meta && meta.nearbyGalleries) gallerySlugs.push(...meta.nearbyGalleries.map(function(g) { return g.slug; }));
    if (gallerySlugs.length > 0) {
      const placeholders = gallerySlugs.map(function(_, i) { return '$' + (i + 1); }).join(',');
      const countResult = await sql('SELECT COUNT(*) as cnt FROM photos WHERE gallery_slug IN (' + placeholders + ') AND is_active = true AND ready_for_public_render = true', gallerySlugs);
      const photos = await sql('SELECT id, slug, title, thumb_url FROM photos WHERE gallery_slug IN (' + placeholders + ') AND is_active = true AND ready_for_public_render = true AND thumb_url IS NOT NULL LIMIT 51', gallerySlugs);
      console.log('getPhotosByLocation:', countResult[0].cnt, 'total,', photos.length, 'returned in', Date.now() - start6, 'ms');
    } else {
      console.log('getPhotosByLocation: no galleries found');
    }

    // Test affiliate blocks
    const start7 = Date.now();
    const ab = await sql(`SELECT id, entity_type, entity_id, provider, title, shortcode, destination_key, priority FROM affiliate_blocks WHERE entity_type = $1 AND entity_id = $2 AND is_active = true`, ['location', loc[0] && loc[0].id]);
    console.log('Affiliate blocks:', ab.length, 'in', Date.now() - start7, 'ms');

  } catch(e) {
    console.error('ERROR:', e.message);
  }
}
test();