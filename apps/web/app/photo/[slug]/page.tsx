import { notFound } from 'next/navigation';
import Link from 'next/link';

// This would fetch from Neon/Typesense in production
async function getPhoto(slug: string) {
  // TODO: Replace with actual DB query
  return {
    id: '1',
    slug: slug,
    title: 'Scarlet Macaw in Flight',
    description: 'A stunning capture of a Scarlet Macaw (Ara macao) flying through the Costa Rican rainforest. These magnificent birds are a symbol of the country\'s rich biodiversity.',
    imageUrl: '/placeholder-macaw.jpg',
    keywords: ['scarlet macaw', 'birds', 'wildlife', 'macaw', 'tropical'],
    gallery: 'birds',
    gallerySlug: 'birds',
    location: 'Carara National Park',
    country: 'Costa Rica',
    takenAt: '2024-03-15',
    camera: 'Canon EOS R5',
    lens: 'RF 100-500mm',
    width: 8192,
    height: 5464,
    orientation: 'landscape',
    lat: 9.7639,
    lon: -84.5684,
    priceDownload: 49.99,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getPhoto(slug);
  
  if (!photo) {
    return { title: 'Photo Not Found' };
  }
  
  return {
    title: `${photo.title} | Wildphotography`,
    description: photo.description,
    openGraph: {
      title: photo.title,
      description: photo.description,
      images: [photo.imageUrl],
    },
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getPhoto(slug);
  
  if (!photo) {
    notFound();
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-4">
        <Link href="/" className="text-primary-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href={`/g/${photo.gallerySlug}`} className="text-primary-600 hover:underline">{photo.gallery}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{photo.title}</span>
      </nav>
      
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Photo display */}
        <div className="lg:col-span-2">
          <div className="aspect-[3/2] bg-gray-200 rounded-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-6xl">
              📷
            </div>
          </div>
        </div>
        
        {/* Photo details */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{photo.title}</h1>
          
          <p className="text-gray-600 mb-6">{photo.description}</p>
          
          {/* Keywords */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {photo.keywords.map((keyword: string) => (
                <Link 
                  key={keyword}
                  href={`/tag/${keyword.replace(/\s+/g, '-')}`}
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm hover:bg-gray-200 transition"
                >
                  {keyword}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Location */}
          <div className="mb-6">
            <h3 className="font-semibold mb-1">Location</h3>
            <p className="text-gray-600">{photo.location}, {photo.country}</p>
          </div>
          
          {/* EXIF data */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Camera Info</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Camera</dt>
              <dd>{photo.camera}</dd>
              <dt className="text-gray-500">Lens</dt>
              <dd>{photo.lens}</dd>
              <dt className="text-gray-500">Dimensions</dt>
              <dd>{photo.width} × {photo.height}</dd>
            </dl>
          </div>
          
          {/* Purchase */}
          <div className="border-t pt-6">
            <p className="text-2xl font-bold mb-4">${photo.priceDownload}</p>
            <button className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold">
              Buy Download
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Original file • Commercial license available
            </p>
          </div>
        </div>
      </div>
      
      {/* Related photos */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Related Photos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Link 
              key={i} 
              href={`/p/related-${i + 1}`}
              className="aspect-square bg-gray-200 rounded-lg hover:opacity-90 transition"
            >
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                📷
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
