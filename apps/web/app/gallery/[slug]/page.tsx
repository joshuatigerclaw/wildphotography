import Link from 'next/link';
import MasonryGrid from '../../../components/MasonryGrid';

// Mock data - replace with DB queries
const galleries = [
  { id: '1', slug: 'birds', title: 'Birds of Costa Rica', description: 'Stunning photographs of Costa Rica\'s incredible avian diversity.' },
  { id: '2', slug: 'wildlife', title: 'Wildlife', description: 'Mammals, reptiles, and more from Costa Rica.' },
  { id: '3', slug: 'landscapes', title: 'Landscapes', description: 'Breathtaking landscapes from volcanic peaks to pristine beaches.' },
  { id: '4', slug: 'rainforests', title: 'Rainforests', description: 'The lush beauty of Costa Rica\'s tropical rainforests.' },
];

const mockPhotos: { id: string; slug: string; title: string; thumbUrl: string | null; smallUrl: string | null; mediumUrl: string | null; locationName: string | null }[] = [
  { id: '1', slug: 'scarlet-macaw', title: 'Scarlet Macaw', thumbUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400', smallUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=900', mediumUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600', locationName: 'Carara' },
  { id: '2', slug: 'quetzal', title: 'Resplendent Quetzal', thumbUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400', smallUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=900', mediumUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1600', locationName: 'Monteverde' },
  { id: '3', slug: 'toucan', title: 'Keel-billed Toucan', thumbUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400', smallUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=900', mediumUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1600', locationName: 'Manuel Antonio' },
  { id: '4', slug: 'sloth', title: 'Three-toed Sloth', thumbUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400', smallUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=900', mediumUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1600', locationName: 'Manuel Antonio' },
  { id: '5', slug: 'monkey', title: 'Capuchin Monkey', thumbUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400', smallUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=900', mediumUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1600', locationName: 'Corcovado' },
  { id: '6', slug: 'iguana', title: 'Green Iguana', thumbUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400', smallUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=900', mediumUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1600', locationName: 'Tortuguero' },
  { id: '7', slug: 'butterfly', title: 'Blue Morpho', thumbUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400', smallUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=900', mediumUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1600', locationName: 'La Selva' },
  { id: '8', slug: 'owl', title: 'Spectacled Owl', thumbUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=400', smallUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=900', mediumUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=1600', locationName: 'Monteverde' },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = galleries.find(g => g.slug === slug);
  if (!gallery) return { title: 'Gallery Not Found' };
  return { title: `${gallery.title} | Wildphotography`, description: gallery.description };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = galleries.find(g => g.slug === slug);
  
  if (!gallery) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl">Gallery not found</h1>
        <Link href="/galleries" className="text-blue-600 hover:underline">Back to galleries</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{gallery.title}</span>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{gallery.title}</h1>
        <p className="text-gray-600 text-lg">{gallery.description}</p>
        <p className="text-sm text-gray-500 mt-2">{mockPhotos.length} photos</p>
      </header>
      
      <MasonryGrid photos={mockPhotos} columns={4} />
    </div>
  );
}
