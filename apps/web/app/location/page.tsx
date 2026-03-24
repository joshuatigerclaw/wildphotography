import Link from 'next/link';
import { Metadata } from 'next';
import { getAllLocations } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Costa Rica Photography Locations | Wildphotography',
  description: 'Explore wildlife photography locations across Costa Rica. From Monteverde cloud forests to the Caribbean coast of Limón.',
  alternates: {
    canonical: `${SITE_URL}/location`,
  },
};

export default async function LocationPage() {
  const locations = await getAllLocations();
  
  const regions = locations.filter(l => l.locationType === 'region');
  const specificLocations = locations.filter(l => l.locationType === 'location');

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">Locations</li>
        </ol>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Costa Rica Photography Locations
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          Discover the best wildlife and nature photography spots across Costa Rica's seven provinces.
        </p>
      </header>

      {/* Regions */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Regions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {regions.map(region => (
            <Link 
              key={region.slug}
              href={`/location/${region.slug}`}
              className="group block"
            >
              <div className="aspect-[4/3] bg-gray-100 rounded-xl mb-3 overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                {region.latitude ? (
                  <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                    <span className="text-4xl">📍</span>
                  </div>
                ) : (
                  <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                    <span className="text-4xl">🗺️</span>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {region.name}
              </h3>
              <p className="text-gray-500 text-sm line-clamp-2">
                {region.description || 'Costa Rica region'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Specific Locations */}
      {specificLocations.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Specific Locations</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {specificLocations.map(loc => (
              <Link 
                key={loc.slug}
                href={`/location/${loc.slug}`}
                className="group block"
              >
                <div className="aspect-[4/3] bg-gray-100 rounded-xl mb-3 overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                  {loc.latitude ? (
                    <div className="w-full h-full bg-green-50 flex items-center justify-center">
                      <span className="text-4xl">📷</span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-green-50 flex items-center justify-center">
                      <span className="text-4xl">🌿</span>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {loc.name}
                </h3>
                <p className="text-gray-500 text-sm">
                  {loc.region}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {locations.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No location data available yet.</p>
        </div>
      )}
    </div>
  );
}
