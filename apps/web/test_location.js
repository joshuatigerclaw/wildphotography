const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function test() {
  try {
    // Test tortuguero location
    const loc = await sql('SELECT id, name, slug, region, location_type, metadata FROM locations WHERE slug = $1', ['tortuguero']);
    console.log('Tortuguero found:', loc.length > 0);
    if (loc.length > 0) {
      console.log('  region:', loc[0].region);
      console.log('  metadata keys:', Object.keys(loc[0].metadata || {}));
      console.log('  galleryLinks:', JSON.stringify(loc[0].metadata?.galleryLinks || [], null, 2));
      console.log('  nearbyGalleries:', JSON.stringify(loc[0].metadata?.nearbyGalleries || [], null, 2));
    }
    
    // Test nearby locations
    const regionName = loc[0] && loc[0].region;
    if (regionName) {
      const nearby = await sql('SELECT id, name, slug FROM locations WHERE region = $1 AND location_type = $2 LIMIT 5', [regionName, 'location']);
      console.log('Nearby locations in', regionName + ':', nearby.map(r => r.name));
    }
    
    // Test the photos query that location/[slug]/page.tsx does
    // First, get gallery slugs from tortuguero metadata
    const meta = loc[0] && loc[0].metadata;
    const gallerySlugs = [];
    if (meta && meta.nearbyGalleries) gallerySlugs.push(...meta.nearbyGalleries.map((g) => g.slug));
    if (meta && meta.galleryLinks) gallerySlugs.push(...meta.galleryLinks.map((g) => g.slug));
    console.log('Gallery slugs to query:', gallerySlugs);
    
    if (gallerySlugs.length > 0) {
      const placeholders = gallerySlugs.map((_, i) => '$' + (i + 1)).join(',');
      const photos = await sql('SELECT id, slug, title, thumb_url FROM photos WHERE gallery_slug IN (' + placeholders + ') LIMIT 3', gallerySlugs);
      console.log('Photos found:', photos.length);
    }
    
    // Test affiliate blocks
    const ab = await sql('SELECT id, entity_type, entity_id, provider, title FROM affiliate_blocks WHERE entity_type = $1 AND entity_id = $2 AND is_active = true LIMIT 3', ['location', loc[0] && loc[0].id]);
    console.log('Affiliate blocks:', ab.length);
    
  } catch(e) {
    console.error('ERROR:', e.message);
  }
}
test();