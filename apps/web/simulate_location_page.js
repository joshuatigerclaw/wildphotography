const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

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

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function withR2Base(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return 'https://images.wildphotography.com/' + url;
}

async function getLocationBySlug(slug) {
  const result = await sql('SELECT id, name, slug, country, region, latitude, longitude, location_type, description, metadata FROM locations WHERE slug = $1', [slug]);
  if (result.length === 0) return null;
  const row = result[0];
  const metadata = parseLocationMeta(row.metadata);
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    country: row.country,
    region: row.region,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    locationType: row.location_type,
    description: row.description,
    metadata,
  };
}

async function getLocationsByRegion(regionName) {
  const result = await sql('SELECT id, name, slug, country, region, latitude, longitude, location_type, description, metadata FROM locations WHERE region = $1 AND location_type = $2 ORDER BY name', [regionName, 'location']);
  return result.map(function(row) {
    const metadata = parseLocationMeta(row.metadata);
    return {
      id: String(row.id),
      name: row.name,
      slug: row.slug,
      country: row.country,
      region: row.region,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      locationType: row.location_type,
      description: row.description,
      metadata,
    };
  });
}

async function getPhotosByLocation(locationSlug, limit, offset) {
  const loc = await getLocationBySlug(locationSlug);
  if (!loc) return { photos: [], total: 0, hasMore: false };

  const meta = parseLocationMeta(loc.metadata);
  const gallerySlugs = [];
  if (meta && meta.nearbyGalleries) gallerySlugs.push(...meta.nearbyGalleries.map(function(g) { return g.slug; }));
  if (meta && meta.galleryLinks) gallerySlugs.push(...meta.galleryLinks.map(function(g) { return g.slug; }));

  console.log('Location:', loc.name, '| gallerySlugs:', gallerySlugs, '| meta keys:', meta ? Object.keys(meta) : 'null');

  if (gallerySlugs.length === 0) {
    return { photos: [], total: 0, hasMore: false };
  }

  const placeholders = gallerySlugs.map(function(_, i) { return '$' + (i + 2); }).join(',');

  const countResult = await sql('SELECT COUNT(*) as count FROM photos p WHERE p.gallery_slug IN (' + placeholders + ') AND p.is_active = true AND p.ready_for_public_render = true', gallerySlugs);
  const total = Number(countResult[0] && countResult[0].count || 0);

  const result = await sql('SELECT p.id, p.slug, p.title, p.description, p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location FROM photos p WHERE p.gallery_slug IN (' + placeholders + ') AND p.is_active = true AND p.ready_for_public_render = true AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL) ORDER BY p.date_uploaded DESC LIMIT $' + (gallerySlugs.length + 2) + ' OFFSET $' + (gallerySlugs.length + 3), [...gallerySlugs, limit + 1, offset]);

  const hasMore = result.length > limit;
  const photos = result.slice(0, limit).map(function(row) {
    return {
      id: String(row.id),
      slug: row.slug,
      title: row.title || '',
      thumbUrl: withR2Base(row.thumb_url),
      smallUrl: withR2Base(row.small_url),
      mediumUrl: withR2Base(row.medium_url),
      largeUrl: withR2Base(row.large_url),
      locationName: row.location,
    };
  });

  return { photos, total, hasMore };
}

async function getAffiliateBlocksForEntity(entityType, entityId) {
  const result = await sql('SELECT id, entity_type, entity_id, provider, title, shortcode, destination_key, priority FROM affiliate_blocks WHERE entity_type = $1 AND entity_id = $2 AND is_active = true ORDER BY priority DESC, provider', [entityType, entityId]);
  return result.map(function(row) {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      provider: row.provider,
      title: row.title,
      shortcode: row.shortcode,
      destinationKey: row.destination_key,
      priority: row.priority,
    };
  });
}

// Simulate the page render for tortuguero
async function simulatePage(slug) {
  console.log('\n=== Simulating page render for:', slug, '===');
  try {
    const location = await getLocationBySlug(slug);
    console.log('1. getLocationBySlug:', location ? location.name + ' (OK)' : 'null');

    const regionName = location && location.region;
    const regionLocations = regionName ? await getLocationsByRegion(regionName) : [];
    console.log('2. getLocationsByRegion:', regionLocations.length, 'locations');

    const nearbyLocs = regionLocations.filter(function(l) { return l.slug !== slug; }).slice(0, 6);
    console.log('3. nearbyLocs:', nearbyLocs.length);

    const { photos, total } = await getPhotosByLocation(slug, 50, 0);
    console.log('4. getPhotosByLocation:', total, 'total,', photos.length, 'returned');

    const affiliateBlocks = location ? await getAffiliateBlocksForEntity('location', Number(location.id)) : [];
    console.log('5. getAffiliateBlocksForEntity:', affiliateBlocks.length);

    console.log('6. ALL QUERIES OK - page should render successfully');
    return true;
  } catch(e) {
    console.error('PAGE RENDER ERROR:', e.message);
    console.error('Stack:', e.stack);
    return false;
  }
}

async function main() {
  await simulatePage('tortuguero');
  await simulatePage('monteverde');
}
main();