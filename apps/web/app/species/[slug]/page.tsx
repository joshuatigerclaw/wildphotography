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

async function getThumbUrl(photoId: number): Promise<string | null> {
  const result = await sql`SELECT thumb_url FROM photos WHERE id = ${photoId}`;
  return result[0]?.thumb_url ? withR2(result[0].thumb_url) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await sql`SELECT * FROM species WHERE slug = ${slug}`;
  const species = result[0];
  if (!species) return { title: 'Species Not Found' };

  const canonical = species.canonical_url || `${SITE_URL}/species/${slug}`;
  const ogImage = species.featured_photo_id
    ? await getThumbUrl(species.featured_photo_id)
    : null;

  return {
    title: species.meta_title || `${species.common_name} in Costa Rica: Photos, Habitat, and Best Places to See It | WildPhotography`,
    description: species.meta_description || `Browse ${species.photo_count} photos of ${species.common_name} in Costa Rica.`,
    alternates: { canonical },
    openGraph: {
      title: species.meta_title || `${species.common_name} | WildPhotography`,
      description: species.meta_description || '',
      url: canonical,
      siteName: 'WildPhotography',
      type: 'website',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : [],
    },
  };
}

export default async function SpeciesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await sql`SELECT * FROM species WHERE slug = ${slug}`;
  const species = result[0];
  if (!species) notFound();

  // Photos for this species via photo_species junction
  const photosResult = await sql`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location,
           p.region, p.country, p.species_common_name, p.species_scientific_name
    FROM photos p
    JOIN photo_species ps ON ps.photo_id = p.id
    WHERE ps.species_id = ${species.id}
      AND p.search_ready = true
      AND p.is_active = true
    ORDER BY p.popularity DESC NULLS LAST
    LIMIT 24
  `;
  const photos = photosResult.map((row: any) => ({
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

  // Locations for this species via page_links
  const locationsResult = await sql`
    SELECT l.*, pl.weight
    FROM locations l
    JOIN page_links pl ON pl.target_id = l.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'location'
    ORDER BY pl.weight DESC NULLS LAST
    LIMIT 10
  `;
  const locations = locationsResult as any[];

  // Galleries featuring this species via page_links
  const galleriesResult = await sql`
    SELECT g.*
    FROM galleries g
    JOIN page_links pl ON pl.target_id = g.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'gallery'
    ORDER BY pl.weight DESC NULLS LAST
    LIMIT 6
  `;
  const galleries = galleriesResult as any[];

  // Related species via page_links
  const relatedResult = await sql`
    SELECT s.*
    FROM species s
    JOIN page_links pl ON pl.target_id = s.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'species'
    LIMIT 6
  `;
  const relatedSpecies = relatedResult as any[];

  // Travel guides / articles via page_links
  const articlesResult = await sql`
    SELECT a.*
    FROM content_articles a
    JOIN page_links pl ON pl.target_id = a.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'article'
      AND a.status = 'published'
    LIMIT 3
  `;
  const articles = articlesResult as any[];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">Home</Link></li>
          <li className="text-gray-400">/</li>
          <li><Link href="/species" className="text-blue-600 hover:underline">Species</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">{species.common_name}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          {species.common_name} in Costa Rica
        </h1>
        {species.scientific_name && (
          <p className="text-xl text-gray-500 italic mb-3">{species.scientific_name}</p>
        )}
        {species.ai_intro ? (
          <p className="text-gray-700 text-lg leading-relaxed max-w-3xl">{species.ai_intro}</p>
        ) : (
          <p className="text-gray-600">{species.photo_count} photographs available</p>
        )}
      </header>

      {/* Quick Facts Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-xl">
        {species.scientific_name && (
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scientific Name</span>
            <p className="text-gray-900 italic">{species.scientific_name}</p>
          </div>
        )}
        {species.animal_group && (
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Group</span>
            <p className="text-gray-900">{species.animal_group}</p>
          </div>
        )}
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photos</span>
          <p className="text-gray-900">{species.photo_count}</p>
        </div>
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Best Locations</span>
          <p className="text-gray-900">{locations.slice(0, 2).map((l: any) => l.name).join(', ') || 'See below'}</p>
        </div>
      </div>

      {/* Featured Photos */}
      {photos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Featured Photos</h2>
          <VirtualizedGallery photos={photos.slice(0, 8)} columns={4} />
        </section>
      )}

      {/* Where to See */}
      {locations.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Where to See {species.common_name} in Costa Rica</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.slice(0, 6).map((loc: any) => (
              <Link
                key={loc.id}
                href={`/location/${loc.slug}`}
                className="p-4 border rounded-xl hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{loc.name}</h3>
                {loc.region && <p className="text-sm text-gray-500 mt-1">{loc.region} region</p>}
                {loc.ai_intro && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{loc.ai_intro}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Galleries */}
      {galleries.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Galleries Featuring {species.common_name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleries.map((g: any) => (
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

      {/* Related Species */}
      {relatedSpecies.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Related Species</h2>
          <div className="flex flex-wrap gap-3">
            {relatedSpecies.map((rs: any) => (
              <Link
                key={rs.id}
                href={`/species/${rs.slug}`}
                className="px-4 py-2 border rounded-full hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-700 hover:text-blue-700"
              >
                {rs.common_name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Travel Guides */}
      {articles.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Travel Guides</h2>
          <div className="space-y-3">
            {articles.map((art: any) => (
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

      {/* Tours CTA - affiliate placeholder */}
      {locations.length > 0 && (
        <section className="mb-10 p-6 bg-amber-50 rounded-xl border border-amber-200">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Tours to See {species.common_name}
          </h2>
          <p className="text-gray-600 mb-4">
            Plan your wildlife photography trip to {locations[0]?.name || 'Costa Rica'} with guided tours.
          </p>
          <Link
            href={`/location/${locations[0]?.slug}`}
            className="inline-block px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
          >
            Find Tours Near {locations[0]?.name || 'This Area'}
          </Link>
        </section>
      )}

      {/* All Photos */}
      {photos.length > 8 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">All {species.common_name} Photos ({photos.length})</h2>
          <VirtualizedGallery photos={photos} columns={4} />
        </section>
      )}
    </div>
  );
}
