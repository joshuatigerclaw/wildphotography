import Link from 'next/link';
import { getGalleries, getAllPhotos } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Wildphotography | Costa Rica Nature Photography',
  description: 'Professional wildlife and nature photography from Costa Rica.',
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
          <h2 className="text-3xl font-bold text-center mb-8">Featured Photos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <Link
                key={photo.id}
                href={`/photo/${photo.slug}`}
                className="group block"
              >
                <div className="aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden">
                  {photo.thumbUrl ? (
                    <img
                      src={photo.thumbUrl}
                      alt={photo.title || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-400">
                      <span className="text-3xl">📷</span>
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-medium mt-2 group-hover:text-blue-600 truncate">
                  {photo.title}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="py-12">
        <h2 className="text-3xl font-bold text-center mb-8">Featured Galleries</h2>
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
