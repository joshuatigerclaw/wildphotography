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
  } catch(e) { return null; }
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
    metadata: parseLocationMeta(row.metadata),
  };
}

async function getLocationsByRegion(regionName) {
  const result = await sql('SELECT id, name, slug, country, region, latitude, longitude, location_type, description, metadata FROM locations WHERE region = $1 AND location_type = $2 ORDER BY name', [regionName, 'location']);
  return result.map(function(row) {
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
      metadata: parseLocationMeta(row.metadata),
    };
  });
}

async function getPhotosByLocation(locationSlug, limit, offset) {
  const loc = await getLocationBySlug(locationSlug);
  if (!loc) return { photos: [], total: 0, hasMore: false };

  const meta = loc.metadata;
  const gallerySlugsSet = new Set();
  if (meta && meta.nearbyGalleries) meta.nearbyGalleries.forEach(function(g) { gallerySlugsSet.add(g.slug); });
  if (meta && meta.galleryLinks) meta.galleryLinks.forEach(function(g) { gallerySlugsSet.add(g.slug); });
  const gallerySlugs = Array.from(gallerySlugsSet);

  if (gallerySlugs.length === 0) {
    return { photos: [], total: 0, hasMore: false };
  }

  // Use ANY($1) - same as our fixed db.ts
  const countResult = await sql('SELECT COUNT(*) as count FROM photos WHERE gallery_slug = ANY($1) AND is_active = true AND ready_for_public_render = true', [gallerySlugs]);
  const total = Number(countResult[0] && countResult[0].count || 0);

  const result = await sql('SELECT id, slug, title, description, description_long, keywords, width, height, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length_mm, lat, lon, views_count, date_taken, date_uploaded, thumb_url, small_url, medium_url, large_url, location FROM photos WHERE gallery_slug = ANY($1) AND is_active = true AND ready_for_public_render = true AND (thumb_url IS NOT NULL OR small_url IS NOT NULL OR medium_url IS NOT NULL OR large_url IS NOT NULL) ORDER BY date_uploaded DESC LIMIT $2 OFFSET $3', [gallerySlugs, limit + 1, offset]);

  const hasMore = result.length > limit;
  const photos = result.slice(0, limit).map(function(row) {
    return {
      id: String(row.id),
      slug: row.slug,
      title: row.title || '',
      description: row.description,
      description_long: row.description_long,
      keywords: row.keywords,
      width: row.width,
      height: row.height,
      camera_make: row.camera_make,
      camera_model: row.camera_model,
      lens: row.lens,
      iso: row.iso,
      aperture: row.aperture,
      shutter_speed: row.shutter_speed,
      focal_length_mm: row.focal_length_mm,
      lat: row.lat,
      lon: row.lon,
      views_count: row.views_count,
      date_taken: row.date_taken,
      date_uploaded: row.date_uploaded,
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
  return result.map(function(row) { return { id: row.id, entityType: row.entity_type, entityId: row.entity_id, provider: row.provider, title: row.title, shortcode: row.shortcode, destinationKey: row.destination_key, priority: row.priority, isActive: true, createdAt: new Date(), updatedAt: new Date() }; });
}

async function renderPage(slug) {
  console.log('\n=== RENDERING PAGE:', slug, '===');
  try {
    const location = await getLocationBySlug(slug);
    if (!location) { console.log('NOT FOUND'); return; }
    console.log('Location OK:', location.name);

    const regionLocations = await getLocationsByRegion(location.region || '');
    console.log('Region locations:', regionLocations.length);

    const nearbyLocs = regionLocations.filter(function(l) { return l.slug !== slug; }).slice(0, 6);
    console.log('Nearby locations:', nearbyLocs.length);

    const { photos, total } = await getPhotosByLocation(slug, 50, 0);
    console.log('Photos:', total, 'total,', photos.length, 'returned, hasMore:', photos.length > 50);

    const affiliateBlocks = await getAffiliateBlocksForEntity('location', Number(location.id));
    console.log('Affiliate blocks:', affiliateBlocks.length);

    console.log('=== RENDER SUCCESS ===');
  } catch(e) {
    console.error('RENDER ERROR:', e.message);
    console.error('Stack:', e.stack);
  }
}

async function main() {
  await renderPage('tortuguero');
  await renderPage('monteverde');
}
main();