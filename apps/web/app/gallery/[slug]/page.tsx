import { notFound } from 'next/navigation';
import Link from 'next/link';

// This would fetch from Neon/Typesense in production
async function getGallery(slug: string) {
  const galleries: Record<string, any> = {
    birds: { id: '1', title: 'Birds of Costa Rica', slug: 'birds', description: 'Stunning photographs of Costa Rica\'s incredible avian diversity.', photoCount: 150 },
    landscapes: { id: '2', title: 'Landscapes', slug: 'landscapes', description: 'Breathtaking landscapes from across Costa Rica.', photoCount: 85 },
    wildlife: { id: '3', title: 'Wildlife', slug: 'wildlife', description: 'Mammals, reptiles, and more from Costa Rica.', photoCount: 120 },
  };
  return galleries[slug] || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = await getGallery(slug);
  if (!gallery) return { title: 'Gallery Not Found' };
  return { title: `${gallery.title} | Wildphotography`, description: gallery.description };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = await getGallery(slug);
  if (!gallery) notFound();

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-4">
        <Link href="/" className="text-primary-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{gallery.title}</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{gallery.title}</h1>
        <p className="text-gray-600 text-lg">{gallery.description}</p>
        <p className="text-sm text-gray-500 mt-2">{gallery.photoCount} photos</p>
      </header>
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <Link key={i} href={`/p/photo-${i + 1}`} className="aspect-square bg-gray-200 rounded-lg hover:opacity-90 transition">
              <div className="w-full h-full flex items-center justify-center text-gray-400"><span className="text-4xl">📷</span></div>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center"><p className="text-gray-500">Showing 12 of {gallery.photoCount} photos</p></div>
      </section>
    </div>
  );
}
