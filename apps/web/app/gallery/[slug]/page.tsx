import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql, getGalleryBySlug } from '@/lib/db';
import GalleryClient from './GalleryClient';

export const dynamic = 'force-dynamic';

const R2_PUBLIC = 'https://images.wildphotography.com';
const SITE_URL = 'https://wildphotography.com';

function withR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

async function getPhotosByGallery(
  gallerySlug: string,
  limit = 100,
  offset = 0
) {
  const GALLERY_PHOTO_ORDER = 'gp.sort_order ASC NULLS LAST, p.date_uploaded ASC NULLS LAST, p.id ASC';

  const countResult = await sql`
    SELECT COUNT(*) as count
    FROM gallery_photos gp
    JOIN galleries g ON gp.gallery_id = g.id
    JOIN photos p ON gp.photo_id = p.id
    WHERE g.slug = ${gallerySlug} AND p.is_active = true AND p.ready_for_public_render = true
  `;
  const total = Number(countResult[0]?.count || 0);

  const result = await sql`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location,
           p.region, p.country, p.species_common_name, p.species_scientific_name
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = ${gallerySlug} AND p.is_active = true AND p.ready_for_public_render = true
    ORDER BY gp.sort_order ASC NULLS LAST, p.date_uploaded ASC NULLS LAST, p.id ASC
    LIMIT ${limit + 1} OFFSET ${offset}
  `;

  const hasMore = result.length > limit;
  const photos = result.slice(0, limit).map((row: any) => ({
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

  return { photos, total, hasMore };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await getGalleryBySlug(slug);

  if (!gallery) return { title: 'Gallery Not Found' };

  const canonical = `${SITE_URL}/gallery/${gallery.slug}`;
  const ogImage = gallery.coverPhotoUrl;

  return {
    title: `${gallery.name} | WildPhotography`,
    description: gallery.description || `${gallery.name} - ${gallery.photoCount} beautiful nature photography images from Costa Rica`,
    alternates: { canonical },
    openGraph: {
      title: `${gallery.name} | WildPhotography`,
      description: gallery.description || `${gallery.name} - ${gallery.photoCount} photos from Costa Rica`,
      url: canonical,
      siteName: 'WildPhotography',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: gallery.name }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${gallery.name} | WildPhotography`,
      description: gallery.description || undefined,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = await getGalleryBySlug(slug);

  if (!gallery) notFound();

  const { photos, total } = await getPhotosByGallery(slug, 100, 0);

  // Species featured in this gallery's photos (via photo_species junction)
  const speciesResult = await sql`
    SELECT s.id, s.common_name, s.scientific_name, s.slug, s.photo_count,
           COUNT(ps.photo_id) as photo_in_gallery
    FROM species s
    JOIN photo_species ps ON ps.species_id = s.id
    JOIN gallery_photos gp ON gp.photo_id = ps.photo_id
    JOIN galleries g ON g.id = gp.gallery_id
    WHERE g.slug = ${slug}
    GROUP BY s.id, s.common_name, s.scientific_name, s.slug, s.photo_count
    ORDER BY photo_in_gallery DESC, s.common_name
    LIMIT 6
  `;
  const species = speciesResult as any[];

  // Locations covered by this gallery's photos (via photo_locations)
  const locationsResult = await sql`
    SELECT DISTINCT l.id, l.name, l.slug, l.region,
           COUNT(DISTINCT gp.photo_id) as photo_count
    FROM locations l
    JOIN photo_locations ploc ON ploc.location_id = l.id
    JOIN gallery_photos gp ON gp.photo_id = ploc.photo_id
    JOIN galleries g ON g.id = gp.gallery_id
    WHERE g.slug = ${slug}
    ORDER BY photo_count DESC, l.name
    LIMIT 6
  `;
  const locations = locationsResult as any[];

  // Fallback: locations from photo.location field
  const locationFallback = await sql`
    SELECT DISTINCT p.location as name, l.slug,
           COUNT(*) as photo_count
    FROM photos p
    JOIN gallery_photos gp ON gp.photo_id = p.id
    JOIN galleries g ON g.id = gp.gallery_id
    LEFT JOIN locations l ON l.name = p.location
    WHERE g.slug = ${slug}
      AND p.location IS NOT NULL AND p.location != ''
    GROUP BY p.location, l.slug
    ORDER BY COUNT(*) DESC
    LIMIT 6
  `;
  const photoLocations = locationFallback as any[];

  // Related galleries: galleries sharing species with this gallery
  const relatedResult = await sql`
    SELECT DISTINCT g2.id, g2.name, g2.slug, g2.description
    FROM galleries g1
    JOIN gallery_photos gp1 ON gp1.gallery_id = g1.id
    JOIN photo_species ps1 ON ps1.photo_id = gp1.photo_id
    JOIN gallery_photos gp2 ON gp2.photo_id = ps1.photo_id
    JOIN galleries g2 ON g2.id = gp2.gallery_id
    WHERE g1.slug = ${slug} AND g2.slug != ${slug} AND g2.is_active = true
    ORDER BY g2.name
    LIMIT 6
  `;
  const relatedGalleries = relatedResult as any[];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">Home</Link></li>
          <li className="text-gray-400">/</li>
          <li><Link href="/galleries" className="text-blue-600 hover:underline">Galleries</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">{gallery.name}</li>
        </ol>
      </nav>

      {/* Gallery header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          {gallery.name}
        </h1>
        {gallery.description && (
          <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
            {gallery.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <span className="font-medium">
            {total > 0 ? `${total} photo${total !== 1 ? 's' : ''}` : 'No photos'}
          </span>
          {gallery.photoCount > 0 && (
            <>
              <span>•</span>
              <span>Costa Rica</span>
            </>
          )}
        </div>
      </header>

      {/* Species in this gallery */}
      {species.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Species in this Gallery</h2>
          <div className="flex flex-wrap gap-3">
            {species.map((s: any) => (
              <Link
                key={s.id}
                href={`/species/${s.slug}`}
                className="px-4 py-2 border rounded-full hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-700 hover:text-blue-700"
              >
                {s.common_name}
                {s.scientific_name && (
                  <span className="text-gray-400 text-xs ml-1 italic">{s.scientific_name}</span>
                )}
                <span className="text-gray-400 text-xs ml-1">({s.photo_in_gallery})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Locations covered */}
      {(locations.length > 0 || photoLocations.length > 0) && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Locations Covered</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.length > 0
              ? locations.map((loc: any) => (
                  <Link
                    key={loc.id}
                    href={`/location/${loc.slug}`}
                    className="p-3 border rounded-lg hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <span className="font-medium text-gray-800">{loc.name}</span>
                    {loc.region && <span className="text-gray-400 text-sm ml-2">({loc.region})</span>}
                  </Link>
                ))
              : photoLocations.map((loc: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <span className="font-medium text-gray-800">{loc.name}</span>
                    <span className="text-gray-400 text-sm ml-2">({loc.photo_count})</span>
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Related galleries */}
      {relatedGalleries.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Related Galleries</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {relatedGalleries.map((g: any) => (
              <Link
                key={g.id}
                href={`/gallery/${g.slug}`}
                className="p-4 border rounded-xl hover:border-blue-400 transition-all"
              >
                <h3 className="font-semibold text-gray-900 hover:text-blue-600">{g.name}</h3>
                {g.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{g.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Affiliate CTA — always shown */}
      <section className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-sm font-semibold text-blue-900 mb-0.5">
          {gallery.name
            ? `Explore tours near ${gallery.name}`
            : 'Explore Costa Rica nature tours'}
        </p>
        <p className="text-xs text-blue-700 mb-3">
          Find guided wildlife, birdwatching, and photography experiences in Costa Rica.
        </p>
        <a
          href={`https://www.getyourguide.com/s/?q=${encodeURIComponent((gallery.name || 'Costa Rica') + ' nature tours')}&partner_id=WILD`}
          target="_blank"
          rel="noopener sponsored"
          className="inline-block text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 transition-colors"
        >
          Browse experiences
        </a>
      </section>

      {/* Photo grid + lightbox */}
      {total > 0 ? (
        <GalleryClient
          photos={photos}
          gallerySlug={gallery.slug}
          galleryName={gallery.name}
        />
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p>No photos in this gallery yet.</p>
          <Link href="/galleries" className="text-blue-600 hover:underline mt-2 inline-block">
            Browse other galleries &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
