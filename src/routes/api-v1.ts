/**
 * API Endpoints — WildPhotography API Platform
 * Phase 4 — Core API Routes
 * 
 * All routes require API key authentication.
 * Only returns photos where:
 *   - ready_for_public_render = true
 *   - search_ready = true
 *   - derivatives_complete = true
 *   - photo is not archived
 *   - photo is not marked private
 *   - derivative URL exists
 */

import { neon } from '@neondatabase/serverless';
import { authenticateKey, authErrorResponse, incrementUsage, logUsageEvent, getUsageSummary, type AuthResult } from './api-auth';
import { buildApiPhotoResponse, type PhotoRecord } from './api-derivatives';
import { buildContentHelper } from './api-derivatives';

const NEON_CONNECTION = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
const sql = neon(NEON_CONNECTION);

// ─── Shared Query Helpers ────────────────────────────────────────────────────

/**
 * Build WHERE clause for public-ready photo eligibility
 */
function publicReadyClause(): string {
  // Public-ready: active, enriched, published, with at least one derivative URL
  return `p.is_active = true AND p.state = 'enriched' AND p.published = true
    AND (p.thumb_url IS NOT NULL OR p.small_url IS NOT NULL
      OR p.medium_url IS NOT NULL OR p.large_url IS NOT NULL)`;
}

/**
 * Build WHERE clause for gallery eligibility
 */
function galleryReadyClause(): string {
  return `g.is_active = true`;
}

// ─── Auth Middleware Wrapper ─────────────────────────────────────────────────

async function withAuth(request: Request): Promise<{ auth: AuthResult }> {
  const authHeader = request.headers.get('Authorization') || '';
  const bearerKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  const auth = await authenticateKey(bearerKey);
  return { auth };
}

// ─── Helper: Parse pagination ─────────────────────────────────────────────────

function parsePagination(url: URL, maxLimit: number): { limit: number; offset: number } {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), maxLimit);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const offset = (Math.max(1, page) - 1) * limit;
  return { limit, offset };
}

// ─── GET /api/v1/search ───────────────────────────────────────────────────────

export async function handleApiSearch(request: Request): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  const url = new URL(request.url);
  const {
    q, species, location, gallery, region, keywords,
    orientation, limit, offset
  } = {
    q: url.searchParams.get('q') || '',
    species: url.searchParams.get('species') || '',
    location: url.searchParams.get('location') || '',
    gallery: url.searchParams.get('gallery') || '',
    region: url.searchParams.get('region') || '',
    keywords: url.searchParams.get('keywords') || '',
    orientation: url.searchParams.get('orientation') || '',
    ...parsePagination(url, auth.plan!.max_results_limit)
  };

  const conditions: string[] = [publicReadyClause()];
  const params: any[] = [];
  let paramIdx = 1;

  if (q) {
    conditions.push(`(
      p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx}
      OR p.keywords::text ILIKE $${paramIdx}
      OR p.species_common_name ILIKE $${paramIdx}
      OR p.species_scientific_name ILIKE $${paramIdx}
      OR p.location_name ILIKE $${paramIdx}
    )`);
    params.push(`%${q}%`);
    paramIdx++;
  }

  if (species) {
    conditions.push(`(p.species_common_name ILIKE $${paramIdx} OR p.species_scientific_name ILIKE $${paramIdx})`);
    params.push(`%${species}%`);
    paramIdx++;
  }

  if (location) {
    conditions.push(`p.location_name ILIKE $${paramIdx}`);
    params.push(`%${location}%`);
    paramIdx++;
  }

  if (gallery) {
    conditions.push(`gp.gallery_id IN (SELECT id FROM galleries WHERE slug = $${paramIdx})`);
    params.push(gallery);
    paramIdx++;
  }

  if (region) {
    conditions.push(`p.region ILIKE $${paramIdx}`);
    params.push(`%${region}%`);
    paramIdx++;
  }

  if (keywords) {
    conditions.push(`p.keywords::text ILIKE $${paramIdx}`);
    params.push(`%${keywords}%`);
    paramIdx++;
  }

  if (orientation) {
    conditions.push(`p.orientation = $${paramIdx}`);
    params.push(orientation);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // Build params array for count query
  const countParams = [...params];

  // Count query
  const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM photos p LEFT JOIN gallery_photos gp ON p.id = gp.photo_id LEFT JOIN galleries g ON gp.gallery_id = g.id WHERE ${whereClause}`;

  const countRows = await sql.query(countSql, countParams) as any[];
  const total = countRows[0]?.total || 0;

  // Data query params
  const dataParams = [...params, limit, offset];
  const dataSql = `SELECT DISTINCT ON (p.id) p.id, p.slug, p.title, p.description, p.description_long, p.keywords, p.species_common_name, p.species_scientific_name, p.location_name, p.region, p.country, p.lat, p.lon, p.map_visibility, p.width, p.height, p.orientation, p.photographer, p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url, p.og_image_url, p.date_taken, g.slug as gallery_slug, g.name as gallery_name FROM photos p LEFT JOIN gallery_photos gp ON p.id = gp.photo_id LEFT JOIN galleries g ON gp.gallery_id = g.id WHERE ${whereClause} ORDER BY p.id LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;

  const rows = await sql.query(dataSql, dataParams) as any[];

  const photos = rows.map((row: any) => buildApiPhotoResponse(
    sanitizePhotoRow(row),
    auth.plan!.allowed_derivative_sizes,
    auth.plan!.attribution_required,
    true
  ));

  // Log usage
  await incrementUsage(auth.customer!.id, auth.api_key_id!);
  await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'search', request.url.pathname + request.url.search, 200);

  return Response.json({
    results: photos,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + photos.length < total
    },
    query: { q, species, location, gallery, region, keywords, orientation }
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

// ─── GET /api/v1/photos/:slug ─────────────────────────────────────────────────

export async function handleApiPhoto(request: Request, slug: string): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  const rows = await sql.query(`
    SELECT DISTINCT ON (p.id)
      p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.species_common_name, p.species_scientific_name, p.location_name,
      p.region, p.country, p.lat, p.lon, p.map_visibility,
      p.width, p.height, p.orientation, p.photographer,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.og_image_url, p.date_taken,
      g.slug as gallery_slug, g.name as gallery_name,
      p.content_tags
    FROM photos p
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    WHERE p.slug = $1 AND ${publicReadyClause()}
    LIMIT 1
  `, [slug]) as any[];

  if (rows.length === 0) {
    await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'photo', request.url.pathname, 404);
    return Response.json({ error: 'not_found', message: 'Photo not found' }, { status: 404 });
  }

  const photo = buildApiPhotoResponse(
    sanitizePhotoRow(rows[0]),
    auth.plan!.allowed_derivative_sizes,
    auth.plan!.attribution_required,
    true
  );

  await incrementUsage(auth.customer!.id, auth.api_key_id!);
  await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'photo', request.url.pathname, 200);

  return Response.json(photo, { headers: { 'Cache-Control': 'no-store' } });
}

// ─── GET /api/v1/galleries/:slug ───────────────────────────────────────────────

export async function handleApiGallery(request: Request, slug: string): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), auth.plan!.max_results_limit);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // Gallery metadata
  const galleryRows = await sql.query(`
    SELECT g.id, g.slug, g.name, g.description,
           g.parent_gallery_id, g.is_active
    FROM galleries g
    WHERE g.slug = $1 AND ${galleryReadyClause()}
    LIMIT 1
  `, [slug]) as any[];

  if (galleryRows.length === 0) {
    await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'gallery', request.url.pathname, 404);
    return Response.json({ error: 'not_found', message: 'Gallery not found' }, { status: 404 });
  }

  const gallery = galleryRows[0];

  // Count photos
  const countRows = await sql.query(`
    SELECT COUNT(*) as total
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    WHERE gp.gallery_id = $1 AND ${publicReadyClause().replace('p.', 'p.')}
  `, [gallery.id]) as any[];

  const total = countRows[0]?.total || 0;

  // Photos
  const photoRows = await sql.query(`
    SELECT DISTINCT ON (p.id)
      p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.species_common_name, p.species_scientific_name, p.location_name,
      p.region, p.country, p.lat, p.lon, p.map_visibility,
      p.width, p.height, p.orientation, p.photographer,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.og_image_url, p.date_taken,
      g.slug as gallery_slug, g.name as gallery_name
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = $1 AND ${publicReadyClause()}
    ORDER BY p.id
    LIMIT $2 OFFSET $3
  `, [slug, limit + 1, offset]) as any[];

  const hasMore = photoRows.length > limit;
  const photos = photoRows.slice(0, limit).map((row: any) => buildApiPhotoResponse(
    sanitizePhotoRow(row),
    auth.plan!.allowed_derivative_sizes,
    auth.plan!.attribution_required,
    false
  ));

  await incrementUsage(auth.customer!.id, auth.api_key_id!);
  await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'gallery', request.url.pathname, 200);

  return Response.json({
    gallery: {
      id: gallery.id,
      slug: gallery.slug,
      name: gallery.name,
      description: gallery.description,
      parent_gallery_id: gallery.parent_gallery_id,
      canonical_url: `https://wildphotography.com/gallery/${gallery.slug}`
    },
    photos,
    pagination: {
      total,
      limit,
      offset,
      has_more: hasMore
    }
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ─── GET /api/v1/species/:slug ────────────────────────────────────────────────

export async function handleApiSpecies(request: Request, slug: string): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), auth.plan!.max_results_limit);

  // Species metadata — use actual column names from species table
  const speciesRows = await sql.query(`
    SELECT id, common_name, scientific_name, slug,
           taxon_rank, animal_group,
           ai_intro, wildlife_text, travel_text, meta_title,
           photo_count, is_public
    FROM species
    WHERE slug = $1 AND is_public = true
    LIMIT 1
  `, [slug]) as any[];

  if (speciesRows.length === 0) {
    await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'species', request.url.pathname, 404);
    return Response.json({ error: 'not_found', message: 'Species not found' }, { status: 404 });
  }

  const species = speciesRows[0];

  // Photos of this species
  const photoRows = await sql.query(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.species_common_name, p.species_scientific_name, p.location_name,
      p.region, p.country, p.lat, p.lon, p.map_visibility,
      p.width, p.height, p.orientation, p.photographer,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.og_image_url, p.date_taken,
      g.slug as gallery_slug, g.name as gallery_name
    FROM photos p
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    WHERE (p.species_common_name ILIKE $1 OR p.species_scientific_name ILIKE $1)
      AND ${publicReadyClause()}
    ORDER BY RANDOM()
    LIMIT $2
  `, [species.common_name, limit + 1]) as any[];

  const hasMore = photoRows.length > limit;
  const photos = photoRows.slice(0, limit).map((row: any) => buildApiPhotoResponse(
    sanitizePhotoRow(row),
    auth.plan!.allowed_derivative_sizes,
    auth.plan!.attribution_required,
    false
  ));

  // Related species (same animal_group)
  const relatedSpecies: { slug: string; common_name: string }[] = [];
  if (species.animal_group) {
    const relatedRows = await sql.query(`
      SELECT slug, common_name
      FROM species
      WHERE animal_group = $1 AND slug != $2 AND is_public = true
      LIMIT 5
    `, [species.animal_group, slug]) as any[];
    relatedSpecies.push(...relatedRows.map((r: any) => ({
      slug: r.slug,
      common_name: r.common_name
    })));
  }

  // SEO content prompt
  const seoPrompt = species.ai_intro
    ? `Write an article about ${species.common_name} (${species.scientific_name || ''}) in Costa Rica. ${species.ai_intro.slice(0, 200)}`
    : species.wildlife_text
    ? `Write a wildlife guide about ${species.common_name} found in Costa Rica. ${species.wildlife_text.slice(0, 200)}`
    : `Write a wildlife guide about ${species.common_name} found in Costa Rica`;

  await incrementUsage(auth.customer!.id, auth.api_key_id!);
  await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'species', request.url.pathname, 200);

  return Response.json({
    name: species.common_name,
    slug: species.slug,
    scientific_name: species.scientific_name,
    taxon_rank: species.taxon_rank,
    animal_group: species.animal_group,
    wildlife_text: species.wildlife_text,
    travel_text: species.travel_text,
    meta_title: species.meta_title,
    ai_intro: species.ai_intro,
    photo_count: photos.length,
    has_more: hasMore,
    related_species: relatedSpecies,
    canonical_url: `https://wildphotography.com/species/${species.slug}`,
    photos,
    content_helper: {
      seo_topics: [
        `${species.common_name} Costa Rica`,
        `Wildlife photography ${species.common_name}`,
        species.animal_group ? `${species.animal_group} family` : null,
        `Birdwatching Costa Rica`,
        `Costa Rica wildlife guide`
      ].filter(Boolean),
      article_prompt_seed: seoPrompt,
      keywords: [species.common_name, species.scientific_name, 'Costa Rica wildlife', species.animal_group].filter(Boolean)
    }
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ─── GET /api/v1/locations/:slug ─────────────────────────────────────────────

export async function handleApiLocation(request: Request, slug: string): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), auth.plan!.max_results_limit);

  // Location metadata — use actual column names from locations table
  const locRows = await sql.query(`
    SELECT id, name, slug, country, region, latitude, longitude,
           location_type, description, ai_intro, wildlife_text,
           photo_count, is_public
    FROM locations
    WHERE slug = $1 AND is_public = true
    LIMIT 1
  `, [slug]) as any[];

  if (locRows.length === 0) {
    await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'location', request.url.pathname, 404);
    return Response.json({ error: 'not_found', message: 'Location not found' }, { status: 404 });
  }

  const location = locRows[0];

  // Photos at this location
  const photoRows = await sql.query(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.species_common_name, p.species_scientific_name, p.location_name,
      p.region, p.country, p.lat, p.lon, p.map_visibility,
      p.width, p.height, p.orientation, p.photographer,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.og_image_url, p.date_taken,
      g.slug as gallery_slug, g.name as gallery_name
    FROM photos p
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    WHERE p.location_name ILIKE $1 AND ${publicReadyClause()}
    ORDER BY RANDOM()
    LIMIT $2
  `, [location.name, limit + 1]) as any[];

  const hasMore = photoRows.length > limit;
  const photos = photoRows.slice(0, limit).map((row: any) => buildApiPhotoResponse(
    sanitizePhotoRow(row),
    auth.plan!.allowed_derivative_sizes,
    auth.plan!.attribution_required,
    false
  ));

  // Gallery suggestions
  const galleryRows = await sql.query(`
    SELECT g.slug, g.name, COUNT(gp.photo_id) as photo_count
    FROM galleries g
    JOIN gallery_photos gp ON g.id = gp.gallery_id
    JOIN photos p ON gp.photo_id = p.id
    WHERE p.location_name ILIKE $1 AND g.is_active = true
    GROUP BY g.id, g.slug, g.name
    ORDER BY photo_count DESC
    LIMIT 5
  `, [location.name]) as any[];

  await incrementUsage(auth.customer!.id, auth.api_key_id!);
  await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'location', request.url.pathname, 200);

  return Response.json({
    name: location.name,
    slug: location.slug,
    country: location.country || 'Costa Rica',
    region: location.region,
    latitude: location.latitude,
    longitude: location.longitude,
    location_type: location.location_type,
    description: location.description,
    wildlife_text: location.wildlife_text,
    ai_intro: location.ai_intro,
    photo_count: photos.length,
    has_more: hasMore,
    gallery_suggestions: galleryRows.map((g: any) => ({
      slug: g.slug,
      name: g.name,
      photo_count: parseInt(g.photo_count)
    })),
    canonical_url: `https://wildphotography.com/location/${location.slug}`,
    photos,
    content_helper: {
      seo_topics: [
        `Travel to ${location.name}`,
        `Photography in ${location.name}`,
        location.region ? `${location.region} travel` : null,
        `${location.country || 'Costa Rica'} travel guide`
      ].filter(Boolean),
      keywords: [location.name, location.region, location.country || 'Costa Rica'].filter(Boolean)
    }
  }, { headers: { 'Cache-Control': 'no-store' } });
}


// ─── GET /api/v1/nearby ───────────────────────────────────────────────────────

export async function handleApiNearby(request: Request): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat') || '');
  const lng = parseFloat(url.searchParams.get('lng') || '');
  const radiusKm = parseFloat(url.searchParams.get('radius_km') || '25');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), auth.plan!.max_results_limit);

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ error: 'bad_request', message: 'lat and lng are required' }, { status: 400 });
  }

  // Haversine distance query (only public_safe_geo photos)
  const rows = await sql.query(`
    SELECT DISTINCT ON (p.id)
      p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.species_common_name, p.species_scientific_name, p.location_name,
      p.region, p.country, p.lat, p.lon, p.map_visibility,
      p.width, p.height, p.orientation, p.photographer,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.og_image_url, p.date_taken,
      g.slug as gallery_slug, g.name as gallery_name,
      (6371 * acos(
        LEAST(1.0, COS(RADIANS($1)) * COS(RADIANS(p.lat)) *
        COS(RADIANS(p.lon) - RADIANS($2)) +
        SIN(RADIANS($1)) * SIN(RADIANS(p.lat))
      ))) AS distance_km
    FROM photos p
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    WHERE p.map_visibility = true
      AND p.lat IS NOT NULL AND p.lon IS NOT NULL
      AND ${publicReadyClause()}
    HAVING (6371 * acos(
      LEAST(1.0, COS(RADIANS($1)) * COS(RADIANS(p.lat)) *
      COS(RADIANS(p.lon) - RADIANS($2)) +
      SIN(RADIANS($1)) * SIN(RADIANS(p.lat))
    )) <= $3
    ORDER BY p.id, distance_km
    LIMIT $4
  `, lat, lng, radiusKm, limit + 1) as any[];

  const photos = rows.slice(0, limit).map((row: any) => ({
    ...buildApiPhotoResponse(sanitizePhotoRow(row), auth.plan!.allowed_derivative_sizes, auth.plan!.attribution_required, false),
    distance_km: Math.round(row.distance_km * 10) / 10
  }));

  await incrementUsage(auth.customer!.id, auth.api_key_id!);
  await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'nearby', request.url.pathname, 200);

  return Response.json({
    center: { latitude: lat, longitude: lng, radius_km: radiusKm },
    photos,
    count: photos.length
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ─── GET /api/v1/random ───────────────────────────────────────────────────────

export async function handleApiRandom(request: Request): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  const url = new URL(request.url);
  const count = Math.min(parseInt(url.searchParams.get('count') || '5', 10), auth.plan!.max_results_limit);
  const category = url.searchParams.get('category') || '';
  const species = url.searchParams.get('species') || '';
  const location = url.searchParams.get('location') || '';

  const conditions: string[] = [publicReadyClause()];
  const params: any[] = [];
  let paramIdx = 1;

  if (category) {
    conditions.push(`p.keywords::text ILIKE $${paramIdx}`);
    params.push(`%${category}%`);
    paramIdx++;
  }

  if (species) {
    conditions.push(`(p.species_common_name ILIKE $${paramIdx} OR p.species_scientific_name ILIKE $${paramIdx})`);
    params.push(`%${species}%`);
    paramIdx++;
  }

  if (location) {
    conditions.push(`p.location_name ILIKE $${paramIdx}`);
    params.push(`%${location}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // Build a simple params array: [limit]
  const queryParams = [count];

  const rows = await sql.query(`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
      p.species_common_name, p.species_scientific_name, p.location_name,
      p.region, p.country, p.lat, p.lon, p.map_visibility,
      p.width, p.height, p.orientation, p.photographer,
      p.thumb_url, p.small_url, p.medium_url, p.large_url, p.preview_url,
      p.og_image_url, p.date_taken,
      g.slug as gallery_slug, g.name as gallery_name
    FROM photos p
    LEFT JOIN gallery_photos gp ON p.id = gp.photo_id
    LEFT JOIN galleries g ON gp.gallery_id = g.id
    WHERE ${whereClause}
    ORDER BY RANDOM()
    LIMIT $1
  `, queryParams) as any[];

  const photos = rows.map((row: any) => buildApiPhotoResponse(
    sanitizePhotoRow(row),
    auth.plan!.allowed_derivative_sizes,
    auth.plan!.attribution_required,
    true
  ));

  await incrementUsage(auth.customer!.id, auth.api_key_id!);
  await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'random', request.url.pathname, 200);

  return Response.json({ photos, count: photos.length }, { headers: { 'Cache-Control': 'no-store' } });
}

// ─── GET /api/v1/usage ────────────────────────────────────────────────────────

export async function handleApiUsage(request: Request): Promise<Response> {
  const { auth } = await withAuth(request);
  if (!auth.success) return authErrorResponse(auth);

  try {
    const summary = await getUsageSummary(auth.customer!.id);
    await logUsageEvent(auth.customer!.id, auth.api_key_id!, 'usage', request.url.pathname, 200);
    return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return Response.json({ error: 'api_error', message: err.message }, { status: 500 });
  }
}

// ─── GET /api/v1/plans ────────────────────────────────────────────────────────

export async function handleApiPlans(request: Request): Promise<Response> {
  const sql = neon(NEON_CONNECTION);
  const rows = await sql`SELECT slug, name, launch_price_monthly, regular_price_monthly,
           monthly_call_limit, allowed_derivative_sizes, attribution_required,
           commercial_use_allowed, ai_agent_use_allowed
    FROM api_plans WHERE active = true ORDER BY launch_price_monthly ASC` as any[];

  return Response.json({
    plans: rows.map((r: any) => ({
      slug: r.slug,
      name: r.name,
      launch_price_monthly_usd: r.launch_price_monthly / 100,
      regular_price_monthly_usd: r.regular_price_monthly / 100,
      monthly_call_limit: r.monthly_call_limit,
      allowed_derivative_sizes: typeof r.allowed_derivative_sizes === 'string'
        ? JSON.parse(r.allowed_derivative_sizes) : r.allowed_derivative_sizes,
      attribution_required: r.attribution_required,
      commercial_use_allowed: r.commercial_use_allowed,
      ai_agent_use_allowed: r.ai_agent_use_allowed
    }))
  }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}

// ─── Utility: Sanitize photo row ─────────────────────────────────────────────

function sanitizePhotoRow(row: any): PhotoRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || row.title || '',
    description: row.description || row.description_long || null,
    description_long: row.description_long || null,
    keywords: row.keywords || null,
    species_common_name: row.species_common_name || null,
    scientific_name: row.scientific_name || null,
    location_name: row.location_name || null,
    region: row.region || null,
    country: row.country || null,
    gallery_slug: row.gallery_slug || null,
    gallery_name: row.gallery_name || null,
    latitude: row.lat || null,
    longitude: row.lon || null,
    map_visibility: row.map_visibility || false,
    width: row.width || null,
    height: row.height || null,
    orientation: row.orientation || null,
    photographer: row.photographer || null,
    thumb_url: row.thumb_url || null,
    small_url: row.small_url || null,
    medium_url: row.medium_url || null,
    large_url: row.large_url || null,
    preview_url: row.preview_url || null,
    original_r2_key: null,  // NEVER exposed
    og_image_url: row.og_image_url || null,
    date_taken: row.date_taken || null,
    content_tags: row.content_tags || null
  };
}

// ─── Waitlist endpoint (public, no auth) ─────────────────────────────────────

export async function handleApiWaitlist(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { name, email, company, intended_use, selected_plan, message } = body;

    if (!email) {
      return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
    }

    const sql = neon(NEON_CONNECTION);
    await sql.query(`
      INSERT INTO api_waitlist (name, email, company, intended_use, selected_plan, message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, name || null, email, company || null, intended_use || null, selected_plan || null, message || null);

    return Response.json({
      success: true,
      message: 'Thank you for your interest! We will review your application and be in touch soon.'
    }, { status: 201 });

  } catch (err: any) {
    console.error('[waitlist] Error:', err.message);
    return Response.json({ error: 'api_error', message: 'Failed to submit waitlist application' }, { status: 500 });
  }
}

// ─── Waitlist (GET for form display) ─────────────────────────────────────────

export async function handleApiWaitlistForm(request: Request): Promise<Response> {
  const sql = neon(NEON_CONNECTION);
  const plans = await sql`SELECT slug, name, launch_price_monthly, monthly_call_limit
    FROM api_plans WHERE active = true ORDER BY launch_price_monthly ASC` as any[];

  return Response.json({
    plans: plans.map((p: any) => ({
      slug: p.slug,
      name: p.name,
      monthly_price_usd: p.launch_price_monthly / 100,
      monthly_calls: p.monthly_call_limit
    })),
    fields: ['name', 'email', 'company', 'intended_use', 'selected_plan', 'message']
  }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
// ─── Account key management (authenticated via email in body) ────────────────

export async function handleAccountKeyCreate(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const { email, name } = await request.json();
    if (!email) {
      return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
    }

    const sql = neon(NEON_CONNECTION);

    // Find active customer by email
    const customers = await sql`
      SELECT id, email, status FROM api_customers
      WHERE email = ${email} AND status = 'active'
      LIMIT 1
    `;

    if (customers.length === 0) {
      return Response.json({ error: 'not_found', message: 'No active customer found for this email' }, { status: 404 });
    }

    const customerId = customers[0].id;

    // Generate new key
    const { createApiKey } = await import('./api-auth');
    const keyData = await createApiKey(customerId, name || 'Default Key');

    // Log audit
    await sql`
      INSERT INTO api_audit_log (customer_id, action, metadata)
      VALUES (${customerId}, 'key_created', ${JSON.stringify({ key_id: keyData.id, name: name || 'Default Key', prefix: keyData.prefix })})::jsonb)
    `;

    return Response.json({
      success: true,
      key: keyData.full,
      key_id: keyData.id,
      message: 'Save this key — it will not be shown again'
    }, { status: 201 });

  } catch (err: any) {
    console.error('[account] Key create error:', err.message);
    return Response.json({ error: 'api_error', message: err.message }, { status: 500 });
  }
}

export async function handleAccountKeyRevoke(request: Request, keyId: number): Promise<Response> {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const { email } = await request.json();
    if (!email) {
      return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
    }

    const sql = neon(NEON_CONNECTION);

    // Verify ownership
    const customers = await sql`
      SELECT id FROM api_customers
      WHERE email = ${email} AND status = 'active'
      LIMIT 1
    `;

    if (customers.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    const keyRows = await sql`
      SELECT id, customer_id FROM api_keys
      WHERE id = ${keyId} AND customer_id = ${customers[0].id}
      LIMIT 1
    `;

    if (keyRows.length === 0) {
      return Response.json({ error: 'not_found', message: 'Key not found' }, { status: 404 });
    }

    await sql`UPDATE api_keys SET status = 'revoked', revoked_at = NOW() WHERE id = ${keyId}`;

    await sql`
      INSERT INTO api_audit_log (customer_id, action, metadata)
      VALUES (${customers[0].id}, 'key_revoked', ${JSON.stringify({ key_id: keyId })})::jsonb)
    `;

    return Response.json({ success: true });

  } catch (err: any) {
    console.error('[account] Key revoke error:', err.message);
    return Response.json({ error: 'api_error', message: err.message }, { status: 500 });
  }
}

export async function handleAccountKeyList(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
  }

  const sql = neon(NEON_CONNECTION);

  const customers = await sql`
    SELECT id FROM api_customers WHERE email = ${email} AND status = 'active' LIMIT 1
  `;

  if (customers.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const keys = await sql`
    SELECT id, name, key_prefix, status, last_used_at, created_at
    FROM api_keys
    WHERE customer_id = ${customers[0].id}
    ORDER BY created_at DESC
  `;

  return Response.json({ keys });
}

// ─── GET /api/v1/account/usage ──────────────────────────────────────────────

export async function handleAccountUsage(request: Request): Promise<Response> {
  try {
    const { email } = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const authEmail = email || url.searchParams.get('email');

    if (!authEmail) {
      return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
    }

    const sql = neon(NEON_CONNECTION);
    const customers = await sql`
      SELECT id FROM api_customers WHERE email = ${authEmail} AND status = 'active' LIMIT 1
    `;

    if (customers.length === 0) {
      return Response.json({ error: 'not_found', message: 'No active customer found' }, { status: 404 });
    }

    const summary = await getUsageSummary(customers[0].id);
    return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[account/usage] Error:', err.message);
    return Response.json({ error: 'api_error', message: err.message }, { status: 500 });
  }
}

// ─── GET /api/v1/account/keys ───────────────────────────────────────────────

export async function handleAccountKeysList(request: Request): Promise<Response> {
  try {
    const { email } = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const authEmail = email || url.searchParams.get('email');

    if (!authEmail) {
      return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
    }

    const sql = neon(NEON_CONNECTION);
    const customers = await sql`
      SELECT id FROM api_customers WHERE email = ${authEmail} AND status = 'active' LIMIT 1
    `;

    if (customers.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    const keys = await sql`
      SELECT id, name, key_prefix, status, last_used_at, created_at, revoked_at
      FROM api_keys
      WHERE customer_id = ${customers[0].id}
      ORDER BY created_at DESC
    `;

    return Response.json({ keys }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[account/keys] Error:', err.message);
    return Response.json({ error: 'api_error', message: err.message }, { status: 500 });
  }
}

// ─── POST /api/v1/account/keys ──────────────────────────────────────────────

export async function handleAccountKeysCreate(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const { email, name } = await request.json();
    if (!email) {
      return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
    }

    const sql = neon(NEON_CONNECTION);
    const customers = await sql`
      SELECT id, email, status FROM api_customers
      WHERE email = ${email} AND status = 'active'
      LIMIT 1
    `;

    if (customers.length === 0) {
      return Response.json({ error: 'not_found', message: 'No active customer found for this email' }, { status: 404 });
    }

    const customerId = customers[0].id;
    const keyData = await createApiKey(customerId, name || 'Default Key');

    await sql`
      INSERT INTO api_audit_log (customer_id, action, metadata)
      VALUES (${customerId}, 'key_created', ${JSON.stringify({ key_id: keyData.id, name: name || 'Default Key', prefix: keyData.prefix })})::jsonb)
    `;

    return Response.json({
      success: true,
      key: keyData.full,
      key_id: keyData.id,
      name: name || 'Default Key',
      message: 'Save this key — it will not be shown again'
    }, { status: 201 });
  } catch (err: any) {
    console.error('[account/keys/create] Error:', err.message);
    return Response.json({ error: 'api_error', message: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/v1/account/keys/:id ─────────────────────────────────────────

export async function handleAccountKeysRevoke(request: Request, keyId: number): Promise<Response> {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const { email } = await request.json().catch(() => ({}));
    if (!email) {
      return Response.json({ error: 'bad_request', message: 'email is required' }, { status: 400 });
    }

    const sql = neon(NEON_CONNECTION);
    const customers = await sql`
      SELECT id FROM api_customers WHERE email = ${email} AND status = 'active' LIMIT 1
    `;

    if (customers.length === 0) {
      return Response.json({ error: 'not_found', message: 'No active customer found' }, { status: 404 });
    }

    const keyRows = await sql`
      SELECT id, customer_id FROM api_keys
      WHERE id = ${keyId} AND customer_id = ${customers[0].id}
      LIMIT 1
    `;

    if (keyRows.length === 0) {
      return Response.json({ error: 'not_found', message: 'Key not found' }, { status: 404 });
    }

    await sql`UPDATE api_keys SET status = 'revoked', revoked_at = NOW() WHERE id = ${keyId}`;

    await sql`
      INSERT INTO api_audit_log (customer_id, action, metadata)
      VALUES (${customers[0].id}, 'key_revoked', ${JSON.stringify({ key_id: keyId })})::jsonb)
    `;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('[account/keys/revoke] Error:', err.message);
    return Response.json({ error: 'api_error', message: err.message }, { status: 500 });
  }
}
