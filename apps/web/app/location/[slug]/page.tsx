import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocationBySlug, getLocationsByRegion, getPhotosByLocation } from '@/lib/db';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export async function generateStaticParams() {
  const { getAllLocations } = await import('@/lib/db');
  const locations = await getAllLocations();
  return locations.map(l => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) return { title: 'Location Not Found' };
  
  const canonical = `${SITE_URL}/location/${slug}`;
  return {
    title: `${location.name} Photography | Wildphotography`,
    description: location.description || `Browse wildlife photography from ${location.name}, Costa Rica.`,
    alternates: { canonical },
    openGraph: {
      title: `${location.name} Photography | Wildphotography`,
      description: location.description || '',
      url: canonical,
      siteName: 'Wildphotography',
      type: 'website',
    },
  };
}

export default async function LocationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const location = await getLocationBySlug(slug);
  if (!location) notFound();

  const regionLocations = await getLocationsByRegion(location.region || '');
  const { photos, total } = await getPhotosByLocation(slug, 50, 0);

  const meta = location.metadata;
  const nearbyLocs = regionLocations.filter(l => l.slug !== slug).slice(0, 6);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">Home</Link></li>
          <li className="text-gray-400">/</li>
          <li><Link href="/location" className="text-blue-600 hover:underline">Locations</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">{location.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">
              {location.locationType === 'region' ? 'Region' : 'Photography Location'} · {location.region}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-1 mb-2">
              {location.name}
            </h1>
            <p className="text-gray-600 max-w-2xl">{location.description}</p>
          </div>
          {location.latitude && location.longitude && (
            <div className="hidden md:block text-right text-sm text-gray-400">
              <div>{location.latitude.toFixed(4)}°N</div>
              <div>{Math.abs(location.longitude).toFixed(4)}°W</div>
            </div>
          )}
        </div>
      </header>

      {/* Overview (region-level) */}
      {meta?.overview && (
        <section className="mb-8 p-6 bg-blue-50 rounded-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-3">About {location.name}</h2>
          <p className="text-gray-700 leading-relaxed">{meta.overview}</p>
        </section>
      )}

      {/* Highlights */}
      {meta?.highlights && meta.highlights.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Highlights</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {meta.highlights.map((h: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-gray-700">
                <span className="text-blue-500 mt-1">•</span>
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Two-column: Info + Galleries */}
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {/* Location Info */}
        <div className="space-y-4">
          {meta?.habitat && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Habitat</h3>
              <p className="text-gray-700 text-sm">{meta.habitat}</p>
            </div>
          )}
          {meta?.seasons && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Best Seasons</h3>
              <p className="text-gray-700 text-sm">{meta.seasons}</p>
            </div>
          )}
          {meta?.targetSpecies && meta.targetSpecies.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Target Species</h3>
              <div className="flex flex-wrap gap-1">
                {meta.targetSpecies.slice(0, 12).map((s: string, i: number) => (
                  <span key={i} className="inline-block px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          {meta?.bestSeason && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Best Time to Visit</h3>
              <p className="text-gray-700 text-sm">{meta.bestSeason}</p>
            </div>
          )}
          {meta?.photographyTips && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Photography Tips</h3>
              <p className="text-gray-700 text-sm">{meta.photographyTips}</p>
            </div>
          )}
        </div>

        {/* Gallery Links */}
        <div>
          {(meta?.galleryLinks || meta?.nearbyGalleries) && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-3">Galleries</h3>
              <div className="space-y-2">
                {((meta?.galleryLinks || meta?.nearbyGalleries) as any[]).slice(0, 10).map((g: any) => (
                  <Link 
                    key={g.slug}
                    href={`/gallery/${g.slug}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-gray-400 group-hover:text-blue-600">→</span>
                    <span className="text-sm text-gray-700 group-hover:text-blue-600">{g.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Species Links */}
        <div>
          {meta?.speciesLinks && meta.speciesLinks.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-3">Species</h3>
              <div className="flex flex-wrap gap-1">
                {meta.speciesLinks.slice(0, 16).map((s: any, i: number) => (
                  <Link 
                    key={s.slug}
                    href={`/species/${s.slug}`}
                    className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full hover:bg-amber-100 transition-colors"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nearby Locations */}
      {nearbyLocs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Nearby Locations in {location.region}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {nearbyLocs.map(loc => (
              <Link 
                key={loc.slug}
                href={`/location/${loc.slug}`}
                className="flex-shrink-0 w-40 p-3 rounded-xl border hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 truncate">{loc.name}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{loc.description || ''}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Photo Gallery */}
      {total > 0 ? (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Photos from {location.name} ({total.toLocaleString()})
          </h2>
          <VirtualizedGallery photos={photos} columns={4} />
        </section>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>No photos indexed for this location yet.</p>
          <Link href="/location" className="text-blue-600 hover:underline mt-2 inline-block">
            Browse other locations →
          </Link>
        </div>
      )}
    </div>
  );
}
