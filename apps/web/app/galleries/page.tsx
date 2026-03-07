import Link from 'next/link';
import MasonryGrid from '../../components/MasonryGrid';

const galleries = [
  { id: '1', slug: 'birds', title: 'Birds of Costa Rica', description: 'Stunning photographs of Costa Rica\'s incredible avian diversity.' },
  { id: '2', slug: 'wildlife', title: 'Wildlife', description: 'Mammals, reptiles, and more from Costa Rica.' },
  { id: '3', slug: 'landscapes', title: 'Landscapes', description: 'Breathtaking landscapes from volcanic peaks to pristine beaches.' },
  { id: '4', slug: 'rainforests', title: 'Rainforests', description: 'The lush beauty of Costa Rica\'s tropical rainforests.' },
];

const mockPhotos = [
  { id: '1', slug: 'scarlet-macaw', title: 'Scarlet Macaw', thumbUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400', locationName: 'Carara' },
  { id: '2', slug: 'quetzal', title: 'Resplendent Quetzal', thumbUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400', locationName: 'Monteverde' },
  { id: '3', slug: 'toucan', title: 'Keel-billed Toucan', thumbUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400', locationName: 'Manuel Antonio' },
  { id: '4', slug: 'sloth', title: 'Three-toed Sloth', thumbUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400', locationName: 'Manuel Antonio' },
  { id: '5', slug: 'monkey', title: 'Capuchin Monkey', thumbUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400', locationName: 'Corcovado' },
  { id: '6', slug: 'iguana', title: 'Green Iguana', thumbUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400', locationName: 'Tortuguero' },
  { id: '7', slug: 'butterfly', title: 'Blue Morpho', thumbUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400', locationName: 'La Selva' },
  { id: '8', slug: 'owl', title: 'Spectacled Owl', thumbUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=400', locationName: 'Monteverde' },
];

export const metadata = {
  title: 'Galleries | Wildphotography',
  description: 'Browse our collection of Costa Rica nature photography galleries.',
};

export default function GalleriesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Photo Galleries</h1>
        <p className="text-gray-600">Browse our collection of Costa Rica nature photography</p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {galleries.map((gallery) => (
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
              {gallery.title}
            </h2>
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
              {gallery.description}
            </p>
            <p className="text-gray-500 text-sm">
              {mockPhotos.length} photos
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
