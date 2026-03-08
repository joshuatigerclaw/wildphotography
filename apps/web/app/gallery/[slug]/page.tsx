import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Types matching VirtualizedGallery
interface PhotoRow {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string | null;
  smallUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  locationName: string | null;
  keywords: string[];
}

interface GalleryData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  photoCount: number;
}

// Mock data for now
const galleriesData: Record<string, GalleryData> = {
  birds: { id: '1', slug: 'birds', name: 'Birds of Costa Rica', description: 'Stunning photographs of Costa Rica\'s incredible avian diversity.', photoCount: 150 },
  wildlife: { id: '2', slug: 'wildlife', name: 'Wildlife', description: 'Mammals, reptiles, and more from Costa Rica.', photoCount: 120 },
  landscapes: { id: '3', slug: 'landscapes', name: 'Landscapes', description: 'Breathtaking landscapes from volcanic peaks to pristine beaches.', photoCount: 85 },
  rainforests: { id: '4', slug: 'rainforests', name: 'Rainforests', description: 'The lush beauty of Costa Rica\'s tropical rainforests.', photoCount: 95 },
};

const mockPhotos: PhotoRow[] = [
  { id: '1', slug: 'scarlet-macaw', title: 'Scarlet Macaw', thumbUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400', smallUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800', mediumUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200', largeUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3', locationName: 'Carara', keywords: ['macaw', 'parrot', 'tropical'] },
  { id: '2', slug: 'quetzal', title: 'Resplendent Quetzal', thumbUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400', smallUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=800', mediumUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1200', largeUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731', locationName: 'Monteverde', keywords: ['quetzal', 'bird', 'cloud-forest'] },
  { id: '3', slug: 'toucan', title: 'Keel-billed Toucan', thumbUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400', smallUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=800', mediumUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1200', largeUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587', locationName: 'Manuel Antonio', keywords: ['toucan', 'tropical', 'bird'] },
  { id: '4', slug: 'sloth', title: 'Three-toed Sloth', thumbUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400', smallUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=800', mediumUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1200', largeUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4', locationName: 'Manuel Antonio', keywords: ['sloth', 'mammal', 'wildlife'] },
  { id: '5', slug: 'monkey', title: 'Capuchin Monkey', thumbUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400', smallUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=800', mediumUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1200', largeUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9', locationName: 'Corcovado', keywords: ['monkey', 'primate', 'wildlife'] },
  { id: '6', slug: 'iguana', title: 'Green Iguana', thumbUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400', smallUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800', mediumUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1200', largeUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62', locationName: 'Tortuguero', keywords: ['iguana', 'reptile', 'tropical'] },
  { id: '7', slug: 'butterfly', title: 'Blue Morpho', thumbUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400', smallUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=800', mediumUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1200', largeUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890', locationName: 'La Selva', keywords: ['butterfly', 'morpho', 'insect'] },
  { id: '8', slug: 'owl', title: 'Spectacled Owl', thumbUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=400', smallUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=800', mediumUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=1200', largeUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf', locationName: 'Monteverde', keywords: ['owl', 'bird', 'nocturnal'] },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = galleriesData[slug];
  if (!gallery) return { title: 'Gallery Not Found' };
  return { 
    title: `${gallery.name} | Wildphotography`, 
    description: gallery.description || `${gallery.name} - ${gallery.photoCount} photos`
  };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = galleriesData[slug];
  
  if (!gallery) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl">Gallery not found</h1>
        <Link href="/galleries" className="text-blue-600 hover:underline">Back to galleries</Link>
      </div>
    );
  }

  // In production, fetch from DB: await getPhotos({ gallerySlug: slug })
  const photos = mockPhotos;
  const hasMore = false; // Would come from DB query

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/galleries" className="text-blue-600 hover:underline">Galleries</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{gallery.name}</span>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{gallery.name}</h1>
        {gallery.description && (
          <p className="text-gray-600 text-lg">{gallery.description}</p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          {photos.length > 0 ? `${photos.length} photos` : 'Loading...'}
        </p>
      </header>
      
      {/* Dynamic import to avoid SSR issues with Virtuoso */}
      {typeof window === 'undefined' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="aspect-[3/4] bg-gray-200 rounded-lg">
              <img 
                src={photo.thumbUrl || '/placeholder.jpg'} 
                alt={photo.title}
                className="w-full h-full object-cover rounded-lg"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      ) : (
        <VirtuosoGalleryWrapper photos={photos} columns={4} hasMore={hasMore} />
      )}
    </div>
  );
}

// Client-side wrapper component
function VirtuosoGalleryWrapper({ photos, columns, hasMore }: { photos: PhotoRow[]; columns: number; hasMore: boolean }) {
  // This will be rendered on client-side
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <a 
          key={photo.id}
          href={`/photo/${photo.slug}`}
          className="block group"
        >
          <div className="aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden">
            <img 
              src={photo.thumbUrl || '/placeholder.jpg'} 
              alt={photo.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <h3 className="text-sm font-medium mt-1 group-hover:text-blue-600">
            {photo.title}
          </h3>
          {photo.locationName && (
            <p className="text-xs text-gray-500">{photo.locationName}</p>
          )}
        </a>
      ))}
    </div>
  );
}
