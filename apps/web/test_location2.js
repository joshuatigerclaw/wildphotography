const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function test() {
  try {
    // Test location pages specifically
    const loc = await sql('SELECT id, name, slug, region, location_type, metadata FROM locations WHERE slug = $1', ['tortuguero']);
    console.log('Tortuguero:', loc.length > 0, '| region:', loc[0] && loc[0].region);

    const regionName = loc[0] && loc[0].region;
    const regionLocs = await sql('SELECT id, name, slug, region FROM locations WHERE region = $1 AND location_type = $2', [regionName, 'location']);
    console.log('Region locations:', regionLocs.length, regionLocs.map(r => r.name));

    const meta = loc[0] && loc[0].metadata;
    const gallerySlugs = [];
    if (meta) {
      if (meta.nearbyGalleries) gallerySlugs.push(...meta.nearbyGalleries.map(function(g) { return g.slug; }));
      if (meta.galleryLinks) gallerySlugs.push(...meta.galleryLinks.map(function(g) { return g.slug; }));
    }
    console.log('Gallery slugs:', gallerySlugs);

    if (gallerySlugs.length > 0) {
      const placeholders = gallerySlugs.map(function(_, i) { return '$' + (i + 1); }).join(',');
      const photos = await sql('SELECT id, slug, title, thumb_url FROM photos WHERE gallery_slug IN (' + placeholders + ') AND is_active = true AND ready_for_public_render = true AND thumb_url IS NOT NULL LIMIT 50', gallerySlugs);
      console.log('Photos:', photos.length);
    } else {
      console.log('No gallery slugs - photos query skipped');
    }

    if (loc[0]) {
      const ab = await sql('SELECT id, entity_type, entity_id, provider, title, shortcode, destination_key, priority FROM affiliate_blocks WHERE entity_type = $1 AND entity_id = $2 AND is_active = true', ['location', loc[0].id]);
      console.log('Affiliate blocks:', ab.length, ab.map(function(b) { return { provider: b.provider, title: b.title }; }));
    }

    // Also test Monteverde
    const loc2 = await sql('SELECT id, name, slug, region, location_type, metadata FROM locations WHERE slug = $1', ['monteverde']);
    console.log('\nMonteverde:', loc2.length > 0, '| region:', loc2[0] && loc2[0].region);
    const meta2 = loc2[0] && loc2[0].metadata;
    const gs2 = [];
    if (meta2) {
      if (meta2.nearbyGalleries) gs2.push(...meta2.nearbyGalleries.map(function(g) { return g.slug; }));
      if (meta2.galleryLinks) gs2.push(...meta2.galleryLinks.map(function(g) { return g.slug; }));
    }
    console.log('Monteverde gallery slugs:', gs2);

  } catch(e) {
    console.error('ERROR:', e.message);
  }
}
test();