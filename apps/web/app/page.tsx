import { Metadata } from 'next';
import Link from 'next/link';
import { getGalleries, getAllPhotos } from '@/lib/db';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Wildphotography | Costa Rica Nature Photography',
  description: 'Professional wildlife, bird, and nature photography from Costa Rica. Explore our galleries of Scarlet Macaws, Toucans, Quetzals, and more.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Wildphotography | Costa Rica Nature Photography',
    description: 'Professional wildlife, bird, and nature photography from Costa Rica.',
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
  const photos = await getAllPhotos(8);

  return (
    <div className="container mx-auto px-4 py-12">
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold mb-6">
          Costa Rica Nature Photography
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Professional wildlife and nature photography from Costa Rica. 
          Explore our galleries, purchase prints, or book a photography tour.
        </p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/search" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Search Photos
          </Link>
          <Link 
            href="/galleries" 
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Browse Galleries
          </Link>
        </div>
      </section>

      {photos.length > 0 && (
        <section className="py-12">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Featured Photos</h2>
            <Link 
              href="/search" 
              className="text-blue-600 hover:underline text-sm"
            >
              View all →
            </Link>
          </div>
          <VirtualizedGallery 
            photos={photos} 
            columns={4}
          />
        </section>
      )}

      <section className="py-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Featured Galleries</h2>
          <Link 
            href="/galleries" 
            className="text-blue-600 hover:underline text-sm"
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
              <div className="aspect-square bg-gray-200 rounded-lg mb-3 overflow-hidden">
                {gallery.coverPhotoUrl ? (
                  <img
                    src={gallery.coverPhotoUrl}
                    alt={gallery.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-400">
                    <span className="text-4xl">📷</span>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-semibold group-hover:text-blue-600 transition">
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
    </div>
  );
}
