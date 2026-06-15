import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Photo Map | Wildphotography',
  description:
    'Explore Wildphotography\'s geotagged image collection on interactive maps. See where every photograph was taken across Costa Rica.',
};

export default function MapPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Wildphotography
          </Link>
          <Link href="/map/costa-rica" className="text-sm text-blue-600 hover:underline">
            View Costa Rica Map →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-stone-900 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-amber-400 font-medium tracking-widest uppercase text-sm mb-4">
            Interactive Maps
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Photographs on the Landscape
          </h1>
          <p className="text-lg text-stone-300">
            Every pin represents a photograph taken at that exact location.
            Click through to explore what lives where.
          </p>
        </div>
      </section>

      {/* Map options */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Costa Rica */}
          <Link
            href="/map/costa-rica"
            className="group block bg-stone-50 rounded-2xl overflow-hidden border border-stone-200 hover:border-amber-400 hover:shadow-lg transition"
          >
            {/* Map preview thumbnail */}
            <div
              className="h-48 bg-stone-200 relative overflow-hidden"
              style={{
                backgroundImage:
                  'url(https://images.wildphotography.com/photos/costa-rica-map-thumb.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="inline-block bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                  ACTIVE
                </span>
              </div>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 group-hover:text-amber-700 transition mb-2">
                Costa Rica
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Every geotagged photograph pinned to the landscape. Browse by region,
                click pins to preview photos, and jump directly to the full image.
                Powered by OpenStreetMap tiles with photo thumbnails as markers.
              </p>
              <span className="text-amber-600 text-sm font-medium group-hover:underline">
                Open map →
              </span>
            </div>
          </Link>

          {/* Coming soon placeholders */}
          {[
            {
              region: 'Central America',
              status: 'Coming Soon',
              note: 'Panama, Nicaragua, Guatemala, and beyond — as the travel archive expands.',
            },
            {
              region: 'International',
              status: 'Coming Soon',
              note: 'Selected international work including Mexico, France, and Southeast Asia.',
            },
          ].map(({ region, status, note }) => (
            <div
              key={region}
              className="group block bg-stone-50 rounded-2xl overflow-hidden border border-stone-200 opacity-70"
            >
              <div className="h-48 bg-stone-200 relative flex items-center justify-center">
                <span className="text-stone-400 text-5xl font-bold">{region[0]}</span>
                <div className="absolute top-4 right-4">
                  <span className="bg-stone-200 text-stone-500 text-xs font-medium px-2 py-1 rounded">
                    {status}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-700 mb-2">{region}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">{note}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div className="mt-12 bg-stone-900 text-white rounded-2xl p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { num: '34,000+', label: 'Photographs' },
              { num: '164', label: 'Galleries' },
              { num: '7', label: 'Provinces Covered' },
              { num: 'Costa Rica', label: 'Primary Territory' },
            ].map(({ num, label }) => (
              <div key={label}>
                <div className="text-2xl md:text-3xl font-bold text-amber-400">{num}</div>
                <div className="text-stone-400 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
