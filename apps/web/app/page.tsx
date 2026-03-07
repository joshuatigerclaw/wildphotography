import Link from 'next/link';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold mb-6">
          Costa Rica Nature Photography
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Professional wildlife and nature photography from Costa Rica. 
          Explore our galleries, purchase prints, or book a photography tour.
        </p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/galleries" 
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            View Galleries
          </Link>
          <Link 
            href="/shop" 
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Shop Prints
          </Link>
        </div>
      </section>

      <section className="py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Featured Collections</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { name: 'Birds of Costa Rica', slug: 'birds', count: 150 },
            { name: 'Landscapes', slug: 'landscapes', count: 85 },
            { name: 'Wildlife', slug: 'wildlife', count: 120 },
          ].map((gallery) => (
            <Link 
              key={gallery.slug}
              href={`/galleries/${gallery.slug}`}
              className="group block"
            >
              <div className="aspect-video bg-gray-200 rounded-lg mb-4 overflow-hidden">
                <div className="w-full h-full bg-primary-100 flex items-center justify-center text-primary-400">
                  <span className="text-4xl">📷</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold group-hover:text-primary-600 transition">
                {gallery.name}
              </h3>
              <p className="text-gray-500">{gallery.count} photos</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
