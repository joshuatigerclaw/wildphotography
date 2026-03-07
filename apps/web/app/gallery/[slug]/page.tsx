import Link from 'next/link';
import { db } from '../../../lib/db';
import { galleries, photos, galleryPhotos } from '../../../lib/schema';
import { eq, desc, asc } from 'drizzle-orm';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = await db.select().from(galleries).where(eq(galleries.slug, slug)).limit(1);
  if (!gallery.length) return { title: 'Gallery Not Found' };
  return { title: `${gallery[0].name} | Wildphotography`, description: gallery[0].description || '' };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Get gallery
  const galleryResult = await db.select().from(galleries).where(eq(galleries.slug, slug)).limit(1);
  const gallery = galleryResult[0];
  
  if (!gallery) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl">Gallery not found</h1>
        <Link href="/galleries" className="text-blue-600 hover:underline">Back to galleries</Link>
      </div>
    );
  }

  // Get photos in this gallery
  const galleryPhotoData = await db
    .select({
      photoId: galleryPhotos.photoId,
      position: galleryPhotos.position,
    })
    .from(galleryPhotos)
    .where(eq(galleryPhotos.galleryId, gallery.id))
    .orderBy(asc(galleryPhotos.position));

  const photoIds = galleryPhotoData.map(gp => gp.photoId);
  
  let galleryPhotosList: any[] = [];
  if (photoIds.length > 0) {
    // Use raw query to get photos by IDs in correct order
    const photoData = await db.execute<any>(`
      SELECT p.* FROM photos p 
      WHERE p.id IN (${photoIds.map((_: any, i: number) => `'${photoIds[i]}'`).join(',')})
    `);
    
    // Sort by position
    const photoMap = new Map(photoData.rows.map((p: any) => [p.id, p]));
    galleryPhotosList = galleryPhotoData.map(gp => ({
      ...photoMap.get(gp.photoId),
      position: gp.position
    })).sort((a, b) => a.position - b.position);
  }

  const photoCount = galleryPhotosList.length;

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{gallery.name}</span>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{gallery.name}</h1>
        <p className="text-gray-600 text-lg">{gallery.description}</p>
        <p className="text-sm text-gray-500 mt-2">{photoCount} photos</p>
      </header>
      
      {photoCount > 0 ? (
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {galleryPhotosList.map((photo: any) => (
            <Link 
              key={photo.id} 
              href={`/photo/${photo.slug}`}
              className="block break-inside-avoid group"
            >
              <div className="relative overflow-hidden rounded-lg">
                <img
                  src={photo.smallUrl || photo.thumbUrl || photo.mediumUrl}
                  alt={photo.title || ''}
                  className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white font-medium text-sm">{photo.title}</p>
                  {photo.locationName && (
                    <p className="text-white/80 text-xs">{photo.locationName}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No photos in this gallery yet.</p>
      )}
    </div>
  );
}
