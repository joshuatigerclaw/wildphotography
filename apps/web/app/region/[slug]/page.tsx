import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { neon } from '@neondatabase/serverless';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const SITE_URL = 'https://www.wildphotography.com';

const sql = neon(DATABASE_URL);

function withR2(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  // Find region by slug (slug is slugified region name)
  const regionResult = await sql`
    SELECT DISTINCT ON (region) region as name, slug
    FROM locations
    WHERE slug = ${slug} OR region ILIKE ${slug.replace(/-/g, ' ')}
    LIMIT 1
  `;

  let regionsData: any[] = [];
  if (regionResult.length === 0) {
    // Fall back: match by region name from photo counts
    const result = await sql`
      SELECT region as name, COUNT(*) as photo_count
      FROM photos
      WHERE region IS NOT NULL AND region != ''
        AND is_active = true AND ready_for_public_render = true
      GROUP BY region
      ORDER BY COUNT(*) DESC
    `;
    regionsData = result as any[];
    const matched = regionsData.find((r: any) => slugify(r.name) === slug);
    if (!matched) return { title: 'Region Not Found' };
  }

  const regionName = regionResult[0]?.name || regionsData.find((r: any) => slugify(r.name) === slug)?.name;
  const canonical = `${SITE_URL}/region/${slug}`;

  const photoCountResult = await sql`
    SELECT COUNT(*) as cnt FROM photos
    WHERE region = ${regionName}
      AND is_active = true AND ready_for_public_render = true
  `;
  const photoCount = Number(photoCountResult[0]?.cnt || 0);

  return {
    title: `${regionName} Photography | WildPhotography`,
    description: `Browse ${photoCount} wildlife and nature photos from ${regionName}, Costa Rica.`,
    alternates: { canonical },
    openGraph: {
      title: `${regionName} Photography | WildPhotography`,
      description: `Explore ${photoCount} photos from ${regionName}, Costa Rica.`,
      url: canonical,
      siteName: 'WildPhotography',
      type: 'website',
    },
  };
}

export default async function RegionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Resolve region name from slug
  const regionResult = await sql`
    SELECT DISTINCT ON (region) region as name, slug
    FROM locations
    WHERE slug = ${slug}
    LIMIT 1
  `;

  let regionName: string;
  if (regionResult.length > 0) {
    regionName = regionResult[0].name;
  } else {
    // Fall back: try ILIKE match on slugified name
    const result = await sql`
      SELECT region as name, COUNT(*) as cnt
      FROM photos
      WHERE region IS NOT NULL AND region != ''
        AND is_active = true AND ready_for_public_render = true
      GROUP BY region
      ORDER BY COUNT(*) DESC
    `;
    const regionsData = result as any[];
    const matched = regionsData.find((r: any) => slugify(r.name) === slug);
    if (!matched) notFound();
    regionName = matched.name;
  }

  // Photos for this region
  const photosResult = await sql`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location,
           p.region, p.country, p.species_common_name, p.species_scientific_name
    FROM photos p
    WHERE p.region = ${regionName}
      AND p.is_active = true AND p.ready_for_public_render = true
    ORDER BY p.date_uploaded DESC
    LIMIT 50
  `;
  const photos = (photosResult as any[]).map((row: any) => ({
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
    thumbUrl: withR2(row.thumb_url),
    smallUrl: withR2(row.small_url),
    mediumUrl: withR2(row.medium_url),
    largeUrl: withR2(row.large_url),
    locationName: row.location,
    region: row.region || null,
    country: row.country || null,
    species_common_name: row.species_common_name || null,
    species_scientific_name: row.species_scientific_name || null,
  }));
  const total = photos.length;

  // Locations in this region
  const locationsResult = await sql`
    SELECT id, name, slug, region, ai_intro
    FROM locations
    WHERE region = ${regionName} AND location_type = 'location'
    ORDER BY name
    LIMIT 20
  `;
  const locations = locationsResult as any[];

  // Top species in this region via photo_locations → photo_species
  const speciesResult = await sql`
    SELECT s.id, s.common_name, s.scientific_name, s.slug, s.photo_count
    FROM species s
    JOIN photo_species ps ON ps.species_id = s.id
    JOIN photos p ON p.id = ps.photo_id
    WHERE p.region = ${regionName}
      AND p.is_active = true AND p.ready_for_public_render = true
      AND p.search_ready = true
    GROUP BY s.id, s.common_name, s.scientific_name, s.slug, s.photo_count
    ORDER BY s.photo_count DESC NULLS LAST
    LIMIT 12
  `;
  const topSpecies = speciesResult as any[];

  // Featured galleries in this region (via page_links in_region)
  const galleriesResult = await sql`
    SELECT DISTINCT g.id, g.name, g.slug, g.description
    FROM galleries g
    JOIN page_links pl ON pl.target_id = g.id
    WHERE pl.link_type = 'in_region'
      AND pl.target_type = 'gallery'
      AND pl.source_type = 'region'
      AND pl.source_id IN (
        SELECT id FROM regions WHERE slug = ${slug} OR name = ${regionName}
      )
    ORDER BY g.name
    LIMIT 6
  `;

  // Fallback: galleries whose photos are in this region
  const galleryFallback = await sql`
    SELECT DISTINCT g.id, g.name, g.slug, g.description
    FROM galleries g
    JOIN gallery_photos gp ON gp.gallery_id = g.id
    JOIN photos p ON p.id = gp.photo_id
    WHERE p.region = ${regionName}
    ORDER BY g.name
    LIMIT 6
  `;
  const galleries = galleriesResult.length > 0 ? galleriesResult : galleryFallback;
  const galleriesList = galleries as any[];

  // Articles covering this region
  const articlesResult = await sql`
    SELECT DISTINCT a.id, a.title, a.slug, a.excerpt
    FROM content_articles a
    JOIN page_links pl ON pl.target_id = a.id
    WHERE pl.source_type = 'region'
      AND pl.target_type = 'article'
      AND pl.source_id IN (
        SELECT id FROM regions WHERE slug = ${slug} OR name = ${regionName}
      )
      AND a.status = 'published'
    ORDER BY a.title
    LIMIT 4
  `;

  // Fallback: articles whose content mentions the region
  const articleFallback = await sql`
    SELECT DISTINCT a.id, a.title, a.slug, a.excerpt
    FROM content_articles a
    WHERE a.status = 'published'
      AND (
        a.content ILIKE '%' || ${regionName} || '%'
        OR a.title ILIKE '%' || ${regionName} || '%'
      )
    ORDER BY a.title
    LIMIT 4
  `;
  const articles = articlesResult.length > 0 ? articlesResult : articleFallback;
  const articlesList = articles as any[];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">Home</Link></li>
          <li className="text-gray-400">/</li>
          <li><Link href="/region" className="text-blue-600 hover:underline">Regions</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">{regionName}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{regionName}</h1>
        <p className="text-gray-600">
          {total.toLocaleString()} photo{total !== 1 ? 's' : ''} from Costa Rica
        </p>
      </header>

      {/* Locations in this region */}
      {locations.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Top Locations in {regionName}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.slice(0, 9).map((loc: any) => (
              <Link
                key={loc.id}
                href={`/location/${loc.slug}`}
                className="p-4 border rounded-xl hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{loc.name}</h3>
                {loc.ai_intro && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{loc.ai_intro}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top species */}
      {topSpecies.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Wildlife in {regionName}</h2>
          <div className="flex flex-wrap gap-3">
            {topSpecies.map((s: any) => (
              <Link
                key={s.id}
                href={`/species/${s.slug}`}
                className="px-4 py-2 border rounded-full hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-700 hover:text-blue-700"
              >
                {s.common_name}
                {s.scientific_name && <span className="text-gray-400 text-xs ml-1 italic">{s.scientific_name}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Galleries */}
      {galleriesList.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Galleries from {regionName}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleriesList.map((g: any) => (
              <Link
                key={g.id}
                href={`/gallery/${g.slug}`}
                className="p-4 border rounded-xl hover:border-blue-400 transition-all"
              >
                <h3 className="font-semibold text-gray-900 hover:text-blue-600">{g.name}</h3>
                {g.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{g.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Travel guides / articles */}
      {articlesList.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Travel Guides for {regionName}</h2>
          <div className="space-y-3">
            {articlesList.map((art: any) => (
              <Link
                key={art.id}
                href={`/article/${art.slug}`}
                className="block p-4 border rounded-xl hover:border-blue-400 transition-all"
              >
                <h3 className="font-semibold text-gray-900 hover:text-blue-600">{art.title}</h3>
                {art.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{art.excerpt}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <VirtualizedGallery photos={photos} columns={4} />
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p>No photos from this region yet.</p>
          <Link href="/region" className="text-blue-600 hover:underline mt-2 inline-block">
            Browse other regions &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
