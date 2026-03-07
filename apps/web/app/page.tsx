import Link from 'next/link';

// Mock data - replace with DB queries later
const galleries = [
  { id: '1', slug: 'birds', title: 'Birds of Costa Rica', description: 'Stunning photographs of Costa Rica\'s incredible avian diversity.', photoCount: 150 },
  { id: '2', slug: 'wildlife', title: 'Wildlife', description: 'Mammals, reptiles, and more from Costa Rica.', photoCount: 120 },
  { id: '3', slug: 'landscapes', title: 'Landscapes', description: 'Breathtaking landscapes from volcanic peaks to pristine beaches.', photoCount: 85 },
  { id: '4', slug: 'rainforests', title: 'Rainforests', description: 'The lush beauty of Costa Rica\'s tropical rainforests.', photoCount: 95 },
];

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold mb-6">
          Costa Rica Nature Photography
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Professional wildlife and nature photography from Costa Rica. 
          Explore our galleries, purchase prints, or book a photography tour.
        </p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/search" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Search Photos
          </Link>
          <Link 
            href="/galleries" 
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Browse Galleries
          </Link>
        </div>
      </section>

      <section className="py-12">
        <h2 className="text-3xl font-bold text-center mb-8">Featured Galleries</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {galleries.map((gallery) => (
            <Link 
              key={gallery.id}
              href={`/gallery/${gallery.slug}`}
              className="group block"
            >
              <div className="aspect-square bg-gray-200 rounded-lg mb-3 overflow-hidden">
                <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-400">
                  <span className="text-4xl">📷</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold group-hover:text-blue-600 transition">
                {gallery.title}
              </h3>
              <p className="text-gray-500 text-sm">
                {gallery.photoCount} photos
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
