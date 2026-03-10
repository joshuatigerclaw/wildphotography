import { Metadata } from 'next';
import Link from 'next/link';
import { getGalleries, getAllPhotos, getRandomPhotos, getPopularPhotos } from '@/lib/db';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Wildphotography | Costa Rica Nature Photography',
  description: 'Professional wildlife, bird, and nature photography from Costa Rica. Explore our galleries of Scarlet Macaws, Toucans, Quetzals, and more.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Wildphotography | Costa Rica Nature Photography',
    description: 'Professional wildlife and nature photography from Costa Rica.',
    url: SITE_URL,
    siteName: 'Wildphotography',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wildphotography | Costa Rica Nature Photography',
    description: 'Professional wildlife and nature photography from Costa Rica.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function Home() {
  const galleries = await getGalleries();
  const recentPhotos = await getAllPhotos(8);
  const randomPhotos = await getRandomPhotos(12);
  const popularPhotos = await getPopularPhotos(8);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center py-12 mb-8">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Costa Rica Nature Photography
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Professional wildlife and nature photography from Costa Rica. 
          Explore our galleries, purchase prints, or book a photography tour.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link 
            href="/search" 
            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
          >
            Search Photos
          </Link>
          <Link 
            href="/galleries" 
            className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            Browse Galleries
          </Link>
        </div>
      </section>

      {/* Popular / Most Viewed */}
      {popularPhotos.length > 0 && (
        <section className="py-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold">🔥 Popular</h2>
              <p className="text-gray-500 mt-1">Most viewed photos</p>
            </div>
          </div>
          <VirtualizedGallery 
            photos={popularPhotos.map(p => ({
              ...p,
              thumbUrl: p.smallUrl || p.mediumUrl || p.thumbUrl,
            }))} 
            columns={4}
          />
        </section>
      )}

      {/* Recent Photos */}
      {recentPhotos.length > 0 && (
        <section className="py-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold">✨ Recent</h2>
              <p className="text-gray-500 mt-1">Latest additions to our collection</p>
            </div>
            <Link 
              href="/search" 
              className="text-blue-600 hover:underline font-medium"
            >
              View all →
            </Link>
          </div>
          <VirtualizedGallery 
            photos={recentPhotos.map(p => ({
              ...p,
              thumbUrl: p.smallUrl || p.mediumUrl || p.thumbUrl,
            }))} 
            columns={4}
          />
        </section>
      )}

      {/* Discover / Random */}
      {randomPhotos.length > 0 && (
        <section className="py-10 bg-gradient-to-b from-gray-50 to-white rounded-2xl px-4 -mx-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold">🎲 Discover</h2>
              <p className="text-gray-500 mt-1">Random selections from our collection</p>
            </div>
            <Link 
              href="/search" 
              className="text-blue-600 hover:underline font-medium"
            >
              Explore more →
            </Link>
          </div>
          <VirtualizedGallery 
            photos={randomPhotos.map(p => ({
              ...p,
              thumbUrl: p.smallUrl || p.mediumUrl || p.thumbUrl,
            }))} 
            columns={6}
          />
        </section>
      )}

      {/* Featured Galleries */}
      <section className="py-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">📁 Featured Galleries</h2>
          <Link 
            href="/galleries" 
            className="text-blue-600 hover:underline font-medium"
          >
            View all →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {galleries.map((gallery) => (
            <Link 
              key={gallery.id}
              href={`/gallery/${gallery.slug}`}
              className="group block"
            >
              <div className="aspect-square bg-gray-100 rounded-xl mb-3 overflow-hidden shadow-md group-hover:shadow-xl transition-shadow">
                {gallery.coverPhotoUrl ? (
                  <img
                    src={gallery.coverPhotoUrl}
                    alt={gallery.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                    <span className="text-5xl">📷</span>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                {gallery.name}
              </h3>
              <p className="text-gray-500 text-sm">
                {gallery.photoCount} photos
              </p>
              {gallery.description && (
                <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                  {gallery.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="py-10 text-center">
        <h2 className="text-2xl font-bold mb-4">About Our Photography</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Joshua ten Brink is a professional wildlife photographer based in Costa Rica. 
          With decades of experience capturing the incredible biodiversity of this beautiful country, 
          his work has been featured in publications worldwide.
        </p>
        <div className="flex justify-center gap-6 mt-6 text-sm text-gray-500">
          <span>🦜 Wildlife</span>
          <span>🌊 Ocean</span>
          <span>🐦 Birds</span>
          <span>🏝️ Landscapes</span>
        </div>
      </section>
    </div>
  );
}
