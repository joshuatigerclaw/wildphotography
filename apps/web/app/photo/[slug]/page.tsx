import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPhotoBySlug } from '@/lib/db';
import ResponsiveImage from '@/components/ResponsiveImage';
import ExifDisplay from '@/components/ExifDisplay';
import KeywordChips from '@/components/KeywordChips';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  if (!photo) return { title: 'Photo Not Found' };
  return { 
    title: `${photo.title} | Wildphotography`, 
    description: photo.description
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  
  if (!photo) {
    notFound();
  }

  const exif = photo.cameraModel || photo.lens ? {
    camera: photo.cameraModel,
    lens: photo.lens,
    dimensions: photo.width && photo.height ? `${photo.width} x ${photo.height}` : undefined,
  } : undefined;

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{photo.title}</span>
      </nav>

      <div className="mb-8">
        {photo.mediumUrl && (
          <ResponsiveImage
            src={photo.mediumUrl}
            alt={photo.title || ''}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
            className="rounded-lg"
          />
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold mb-4">{photo.title}</h1>
          
          {photo.locationName && (
            <p className="text-lg text-gray-600 mb-4">📍 {photo.locationName}</p>
          )}

          {photo.description && (
            <p className="text-gray-700 leading-relaxed mb-8">{photo.description}</p>
          )}

          {photo.keywords && photo.keywords.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Keywords</h2>
              <KeywordChips keywords={photo.keywords.filter(Boolean)} />
            </div>
          )}
        </div>

        <div>
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Purchase</h3>
            <div className="space-y-3">
              <button className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition" disabled>
                Buy Print ($49)
              </button>
              <button className="w-full px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition" disabled>
                Download ($29)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">Coming soon</p>
          </div>

          <ExifDisplay exif={exif} />
        </div>
      </div>
    </div>
  );
}
