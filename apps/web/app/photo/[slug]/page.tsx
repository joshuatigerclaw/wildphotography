import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '../../../lib/db';
import { photos, keywords, photoKeywords } from '../../../lib/schema';
import { eq } from 'drizzle-orm';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photoResult = await db.select().from(photos).where(eq(photos.slug, slug)).limit(1);
  const photo = photoResult[0];
  if (!photo) return { title: 'Photo Not Found' };
  return { title: `${photo.title} | Wildphotography`, description: photo.descriptionLong || '' };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const photoResult = await db.select().from(photos).where(eq(photos.slug, slug)).limit(1);
  const photo = photoResult[0];
  
  if (!photo) {
    notFound();
  }

  // Get keywords
  const kwResult = await db
    .select({ keyword: keywords.keyword })
    .from(photoKeywords)
    .innerJoin(keywords, eq(photoKeywords.keywordId, keywords.id))
    .where(eq(photoKeywords.photoId, photo.id));

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/galleries" className="text-blue-600 hover:underline">Galleries</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{photo.title}</span>
      </nav>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={photo.mediumUrl || photo.largeUrl || photo.smallUrl || ''}
              alt={photo.title || ''}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-4">{photo.title}</h1>
          <p className="text-gray-600 mb-6">{photo.descriptionLong}</p>

          {kwResult.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {kwResult.map((kw) => (
                  <span key={kw.keyword} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                    {kw.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {photo.locationName && (
            <div className="mb-6">
              <h3 className="font-semibold mb-1">Location</h3>
              <p className="text-gray-600">{photo.locationName}{photo.country ? `, ${photo.country}` : ''}</p>
            </div>
          )}

          {(photo.cameraMake || photo.cameraModel || photo.lens) && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Camera Info</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {photo.cameraMake && (
                  <>
                    <dt className="text-gray-500">Camera</dt>
                    <dd>{photo.cameraMake} {photo.cameraModel}</dd>
                  </>
                )}
                {photo.lens && (
                  <>
                    <dt className="text-gray-500">Lens</dt>
                    <dd>{photo.lens}</dd>
                  </>
                )}
                {photo.width && photo.height && (
                  <>
                    <dt className="text-gray-500">Dimensions</dt>
                    <dd>{photo.width} x {photo.height}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          <div className="border-t pt-6">
            <p className="text-2xl font-bold mb-4">
              {photo.priceDownload ? `$${photo.priceDownload}` : 'Contact for pricing'}
            </p>
            <button className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
              Buy Download
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Original file • Commercial license available
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
