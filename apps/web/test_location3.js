const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

// Replicate parseLocationMeta exactly
function parseLocationMeta(raw) {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      overview: obj.overview,
      habitat: obj.habitat,
      seasons: obj.seasons,
      targetSpecies: obj.target_species || obj.targetSpecies,
      nearbyGalleries: obj.nearby_galleries || obj.nearbyGalleries,
      photographyTips: obj.photography_tips || obj.photographyTips,
      highlights: obj.highlights,
      bestSeason: obj.best_season || obj.bestSeason,
      galleryLinks: obj.gallery_links || obj.galleryLinks,
      speciesLinks: obj.species_links || obj.speciesLinks,
    };
  } catch(e) {
    console.error('parse error:', e.message);
    return null;
  }
}

async function test() {
  try {
    const loc = await sql('SELECT id, name, slug, region, metadata FROM locations WHERE slug = $1', ['tortuguero']);
    console.log('raw metadata type:', typeof loc[0].metadata);
    console.log('raw metadata keys:', Object.keys(loc[0].metadata || {}));
    console.log('raw gallery_links:', JSON.stringify(loc[0].metadata.gallery_links || [], null, 2));

    const parsed = parseLocationMeta(loc[0].metadata);
    console.log('\nparsed galleryLinks:', JSON.stringify(parsed && parsed.galleryLinks || [], null, 2));
    console.log('parsed nearbyGalleries:', JSON.stringify(parsed && parsed.nearbyGalleries || [], null, 2));

    const R2_PUBLIC = 'https://images.wildphotography.com';
    function withR2Base(url) {
      if (!url) return null;
      if (url.startsWith('http')) return url;
      return R2_PUBLIC + '/' + url;
    }
    const gl = parsed && (parsed.galleryLinks || parsed.nearbyGalleries) || [];
    console.log('\nGallery slugs for query:', gl.map(function(g) { return g.slug; }));
    if (gl.length > 0) {
      const placeholders = gl.map(function(_, i) { return '$' + (i + 1); }).join(',');
      const photos = await sql('SELECT id, slug FROM photos WHERE gallery_slug IN (' + placeholders + ') AND is_active = true AND ready_for_public_render = true LIMIT 3', gl.map(function(g) { return g.slug; }));
      console.log('Photos found:', photos.length);
    }

  } catch(e) {
    console.error('ERROR:', e.message);
  }
}
test();