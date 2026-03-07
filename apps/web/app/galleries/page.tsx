import Link from 'next/link';
import { db } from '../../lib/db';
import { galleries, galleryPhotos } from '../../lib/schema';
import { eq, sql } from 'drizzle-orm';

export const metadata = {
  title: 'Galleries | Wildphotography',
  description: 'Browse our collection of Costa Rica nature photography galleries.',
};

export default async function GalleriesPage() {
  // Get galleries with photo counts
  const galleriesData = await db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      name: galleries.name,
      description: galleries.description,
    })
    .from(galleries)
    .where(eq(galleries.status, 'public'));

  // Get photo counts for each gallery
  const galleriesWithCounts = await Promise.all(
    galleriesData.map(async (gallery) => {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(galleryPhotos)
        .where(eq(galleryPhotos.galleryId, gallery.id));
      return {
        ...gallery,
        photoCount: countResult[0]?.count || 0
      };
    })
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Photo Galleries</h1>
        <p className="text-gray-600">Browse our collection of Costa Rica nature photography</p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {galleriesWithCounts.map((gallery) => (
          <Link 
            key={gallery.id}
            href={`/gallery/${gallery.slug}`}
            className="group block"
          >
            <div className="aspect-video bg-gray-200 rounded-lg mb-3 overflow-hidden">
              <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-400">
                <span className="text-4xl">📷</span>
              </div>
            </div>
            <h2 className="text-xl font-semibold group-hover:text-blue-600 transition">
              {gallery.name}
            </h2>
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
              {gallery.description}
            </p>
            <p className="text-gray-500 text-sm">
              {gallery.photoCount} photos
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
