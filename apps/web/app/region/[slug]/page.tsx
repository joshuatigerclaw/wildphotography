import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllRegions, getPhotosByRegion, getLocationsByRegion } from '@/lib/db';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

/**
 * Generate static params for region routes
 */
export async function generateStaticParams() {
  const regions = await getAllRegions();
  return regions.map(r => ({
    slug: r.slug,
  }));
}

/**
 * Generate metadata for region page
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const allRegions = await getAllRegions();
  const regionData = allRegions.find(r => r.slug === slug);
  
  if (!regionData) {
    return { title: 'Region Not Found' };
  }
  
  const canonical = `${SITE_URL}/region/${slug}`;
  const ogImage = regionData.sampleThumb;
  
  return {
    title: `${regionData.name} Photography | Wildphotography`,
    description: regionData.overview || `Browse ${regionData.photoCount} photos from ${regionData.name}, Costa Rica. Stunning wildlife and nature photography.`,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${regionData.name} Photography | Wildphotography`,
      description: regionData.overview || `Explore ${regionData.photoCount} photos from ${regionData.name}, Costa Rica.`,
      url: canonical,
      siteName: 'Wildphotography',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: regionData.name }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${regionData.name} Photography | Wildphotography`,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function RegionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const allRegions = await getAllRegions();
  const regionData = allRegions.find(r => r.slug === slug);
  
  if (!regionData) {
    notFound();
  }

  const [regionLocations, { photos, total }] = await Promise.all([
    getLocationsByRegion(regionData.name),
    getPhotosByRegion(regionData.name, 50, 0),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">Home</Link></li>
          <li className="text-gray-400">/</li>
          <li><Link href="/region" className="text-blue-600 hover:underline">Regions</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">{regionData.name}</li>
        </ol>
      </nav>

      {/* Region Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          {regionData.name}
        </h1>
        <p className="text-gray-600">
          {total.toLocaleString()} photo{total !== 1 ? 's' : ''} from Costa Rica
        </p>
      </header>

      {/* Overview */}
      {regionData.overview && (
        <section className="mb-8 p-6 bg-blue-50 rounded-xl">
          <p className="text-gray-700 leading-relaxed">{regionData.overview}</p>
        </section>
      )}

      {/* Highlights */}
      {regionData.highlights && regionData.highlights.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Highlights</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {regionData.highlights.map((h: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-gray-700">
                <span className="text-blue-500 mt-1">•</span>
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Info + Galleries + Species */}
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {/* Best season & tips */}
        <div className="space-y-4">
          {regionData.bestSeason && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Best Time to Visit</h3>
              <p className="text-gray-700 text-sm">{regionData.bestSeason}</p>
            </div>
          )}
          {regionData.photographyTips && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Photography Tips</h3>
              <p className="text-gray-700 text-sm">{regionData.photographyTips}</p>
            </div>
          )}
        </div>

        {/* Gallery Links */}
        {regionData.galleryLinks && regionData.galleryLinks.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-3">Galleries</h3>
            <div className="space-y-2">
              {regionData.galleryLinks.slice(0, 10).map((g: any) => (
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

        {/* Species Links */}
        {regionData.speciesLinks && regionData.speciesLinks.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-3">Species</h3>
            <div className="flex flex-wrap gap-1">
              {regionData.speciesLinks.slice(0, 16).map((s: any, i: number) => (
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

      {/* Photo Grid */}
      {total > 0 ? (
        <VirtualizedGallery 
          photos={photos} 
          columns={4}
        />
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
