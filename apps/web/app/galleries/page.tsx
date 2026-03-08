import Link from 'next/link';
import { getGalleries } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Photo Galleries | Wildphotography',
  description: 'Browse our collection of nature and wildlife photography from Costa Rica.',
};

export default async function GalleriesPage() {
  const galleries = await getGalleries();

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Galleries</span>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Photo Galleries</h1>
        <p className="text-gray-600 text-lg">
          Explore our collection of {galleries.length} galleries featuring Costa Rica's incredible biodiversity.
        </p>
      </header>
      
      {galleries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No galleries available yet.</p>
          <p className="text-sm mt-2">Check back soon for new photo collections!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
      )}
    </div>
  );
}
