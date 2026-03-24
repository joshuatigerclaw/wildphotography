import Link from 'next/link';
import { Metadata } from 'next';
import { getAllRegions } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Costa Rica Regions | Wildphotography',
  description: 'Explore wildlife photography from different regions of Costa Rica. From Guanacaste beaches to the Caribbean coast of Limón.',
  alternates: {
    canonical: `${SITE_URL}/region`,
  },
  openGraph: {
    title: 'Costa Rica Regions | Wildphotography',
    description: 'Explore wildlife photography from different regions of Costa Rica.',
    url: `${SITE_URL}/region`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

export default async function RegionPage() {
  const regions = await getAllRegions();

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">Regions</li>
        </ol>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Costa Rica Regions
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          Explore wildlife photography from across Costa Rica's diverse regions. 
          From the dry forests of Guanacaste to the cloud forests of Monteverde.
        </p>
      </header>
      
      {regions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No region data available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {regions.map((region) => (
            <Link 
              key={region.slug}
              href={`/region/${region.slug}`}
              className="group block"
            >
              <div className="aspect-[4/3] bg-gray-100 rounded-xl mb-3 overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                {region.sampleThumb ? (
                  <img 
                    src={region.sampleThumb}
                    alt={region.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                    <span className="text-4xl">🌴</span>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {region.name}
              </h3>
              <p className="text-gray-500 text-sm">
                {region.photoCount.toLocaleString()} photo{region.photoCount !== 1 ? 's' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
