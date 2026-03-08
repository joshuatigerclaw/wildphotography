import { notFound } from 'next/navigation';
import Link from 'next/link';

const photos = [
  { id: '1', slug: 'scarlet-macaw', title: 'Scarlet Macaw in Flight', description: 'A stunning capture of a Scarlet Macaw (Ara macao) in flight over the Costa Rican rainforest.', keywords: ['scarlet macaw', 'birds', 'wildlife'], location: 'Carara National Park', country: 'Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', price: 49.99, imageUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600' },
  { id: '2', slug: 'resplendent-quetzal', title: 'Resplendent Quetzal', description: 'The magnificent Resplendent Quetzal in all its glory.', keywords: ['quetzal', 'birds'], location: 'Monteverde Cloud Forest', country: 'Costa Rica', camera: 'Canon EOS R5', lens: 'RF 600mm', price: 59.99, imageUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1600' },
  { id: '3', slug: 'toucan', title: 'Keel-billed Toucan', description: 'The colorful Keel-billed Toucan is known for its spectacular rainbow-colored bill.', keywords: ['toucan', 'birds'], location: 'Manuel Antonio', country: 'Costa Rica', camera: 'Canon EOS R5', lens: 'RF 100-500mm', price: 39.99, imageUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1600' },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = photos.find(p => p.slug === slug);
  if (!photo) return { title: 'Photo Not Found' };
  return { title: `${photo.title} | Wildphotography`, description: photo.description };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = photos.find(p => p.slug === slug);
  
  if (!photo) {
    notFound();
  }

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
              src={photo.imageUrl}
              alt={photo.title}
              className="w-full h-full object-contain"
            />
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
            <p className="text-gray-600">{photo.location}, {photo.country}</p>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Camera Info</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Camera</dt>
              <dd>{photo.camera}</dd>
              <dt className="text-gray-500">Lens</dt>
              <dd>{photo.lens}</dd>
            </dl>
          </div>

          <div className="border-t pt-6">
            <p className="text-2xl font-bold mb-4">${photo.price}</p>
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
