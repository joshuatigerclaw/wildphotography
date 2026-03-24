import Link from 'next/link';
import { Metadata } from 'next';
import { getGalleries } from '@/lib/db';
import { canonicalUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Photo Galleries | Wildphotography',
  description: 'Browse our collection of nature and wildlife photography from Costa Rica. Explore wildlife, landscapes, birds, and more.',
  alternates: {
    canonical: canonicalUrl('/galleries'),
  },
  openGraph: {
    title: 'Photo Galleries | Wildphotography',
    description: 'Browse our collection of nature and wildlife photography from Costa Rica.',
    url: `${SITE_URL}/galleries`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

export default async function GalleriesPage() {
  const galleries = await getGalleries();

  // Sort galleries by photo count
  const sortedGalleries = [...galleries].sort((a, b) => b.photoCount - a.photoCount);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">Galleries</li>
        </ol>
      </nav>
      
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Photo Galleries
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          Explore our collection of {galleries.length} galleries featuring Costa Rica's incredible biodiversity, landscapes, and wildlife.
        </p>
      </header>
      
      {sortedGalleries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No galleries available yet.</p>
          <p className="text-sm mt-2">Check back soon for new photo collections!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {sortedGalleries.map((gallery) => (
            <Link 
              key={gallery.id}
              href={`/gallery/${gallery.slug}`}
              className="group block"
            >
              <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                {gallery.coverPhotoUrl ? (
                  <img 
                    src={gallery.coverPhotoUrl}
                    alt={gallery.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-300">
                    <span className="text-3xl">📷</span>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition text-sm md:text-base">
                {gallery.name}
              </h3>
              <p className="text-gray-500 text-xs md:text-sm">
                {gallery.photoCount} photo{gallery.photoCount !== 1 ? 's' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
