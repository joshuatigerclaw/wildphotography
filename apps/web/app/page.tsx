import Link from 'next/link';
import { db } from '../lib/db';
import { galleries, galleryPhotos } from '../lib/schema';
import { eq, sql } from 'drizzle-orm';

export default async function Home() {
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

      <section className="py-12">
        <h2 className="text-3xl font-bold text-center mb-8">Featured Galleries</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {galleriesWithCounts.map((gallery) => (
            <Link 
              key={gallery.id}
              href={`/gallery/${gallery.slug}`}
              className="group block"
            >
              <div className="aspect-square bg-gray-200 rounded-lg mb-3 overflow-hidden">
                <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-400">
                  <span className="text-4xl">📷</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold group-hover:text-blue-600 transition">
                {gallery.name}
              </h3>
              <p className="text-gray-500 text-sm">
                {gallery.photoCount} photos
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
