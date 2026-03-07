import { notFound } from 'next/navigation';
import Link from 'next/link';

const photos = [
  { slug: 'scarlet-macaw', title: 'Scarlet Macaw in Flight', description: 'A stunning capture of a Scarlet Macaw (Ara macao) flying through the Costa Rican rainforest.', keywords: ['scarlet macaw', 'birds', 'wildlife'], gallery: 'birds', gallerySlug: 'birds', location: 'Carara National Park', price: 49.99 },
  { slug: 'resplendent-quetzal', title: 'Resplendent Quetzal', description: 'The magnificent Resplendent Quetzal in all its glory.', keywords: ['quetzal', 'birds'], gallery: 'birds', gallerySlug: 'birds', location: 'Monteverde', price: 59.99 },
  { slug: 'toucan', title: 'Keel-billed Toucan', description: 'The colorful Keel-billed Toucan.', keywords: ['toucan', 'birds'], gallery: 'birds', gallerySlug: 'birds', location: 'Manuel Antonio', price: 39.99 },
];

export function generateStaticParams() {
  return photos.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = photos.find(p => p.slug === slug);
  
  if (!photo) {
    return { title: 'Photo Not Found' };
  }
  
  return {
    title: `${photo.title} | Wildphotography`,
    description: photo.description,
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = photos.find(p => p.slug === slug);
  
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
        <div className="lg:col-span-2">
          <div className="aspect-[3/2] bg-gray-200 rounded-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-6xl">
              📷
            </div>
          </div>
        </div>
        
        <div>
          <h1 className="text-3xl font-bold mb-4">{photo.title}</h1>
          <p className="text-gray-600 mb-6">{photo.description}</p>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {photo.keywords.map((keyword: string) => (
                <span key={keyword} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-1">Location</h3>
            <p className="text-gray-600">{photo.location}</p>
          </div>
          
          <div className="border-t pt-6">
            <p className="text-2xl font-bold mb-4">${photo.price}</p>
            <button className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold">
              Buy Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
