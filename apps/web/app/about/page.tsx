import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Joshua ten Brink | Wildphotography',
  description:
    'Joshua ten Brink is a professional wildlife photographer based in Costa Rica. With over a decade behind the lens in one of the world\'s most biodiverse countries, he documents the birds, wildlife, and landscapes that make Costa Rica extraordinary.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-stone-900 text-white py-24 px-4">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'url(https://images.wildphotography.com/photos/wildlife-hero.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-amber-400 font-medium tracking-widest uppercase text-sm mb-4">
            About the Photographer
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Joshua ten Brink
          </h1>
          <p className="text-lg text-stone-300 max-w-2xl mx-auto">
            Documenting Costa Rica&apos;s wild side — one frame at a time.
          </p>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-16">
        {/* Story */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">The Story Behind the Lens</h2>
          <div className="prose prose-lg text-gray-600 space-y-4">
            <p>
              I moved to Costa Rica more than a decade ago, drawn by the country's reputation as
              one of the most biodiverse places on earth. What started as a love affair with
              the landscape turned into something far more consuming — a deep, almost obsessive
              passion for wildlife photography.
            </p>
            <p>
              Costa Rica covers less than 0.03% of the world&apos;s land area, yet it contains
              roughly 5% of the planet&apos;s known species. In a single day of birding you might
              encounter more species here than in an entire year in much of Europe or North America.
              That abundance is what keeps me coming back, morning after morning, often before
              dawn to catch the forest at its quietest.
            </p>
            <p>
              My work spans the full breadth of Costa Rica&apos;s natural offerings: Scarlet Macaws
              arcing across the Osa Peninsula canopy, resplendent quetzals in the cloud forests
              of San Gerardo de Dota, humpback whales breasing off the Pacific coast, and
              frogs the size of a thumbnail perched on leaves in Monteverde. I&apos;ve walked
              into Carara at dusk specifically to hear the macaws return to their roost, and
              I&apos;ve sat motionless in Corcovado for hours waiting for a tapir to cross a forest trail.
            </p>
            <p>
              The collection now numbers over 50,000 images. Every photograph in this archive
              was taken in the field — no studios, no staged setups, no captive animals.
              What you see is what Costa Rica actually looks like, filtered through a very
              long lens.
            </p>
          </div>
        </section>

        {/* What this site is */}
        <section className="bg-stone-50 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What This Site Is</h2>
          <p className="text-gray-600 leading-relaxed">
            Wildphotography.com is the public face of that archive — a curated selection of
            the best photographs organized by species, location, and region. The site serves
            three purposes: it lets people who are planning a trip to Costa Rica discover
            what&apos;s actually out there and where to find it, it offers a way to{' '}
            <a href="/buy" className="text-amber-600 hover:underline">
              purchase prints
            </a>{' '}
            of work they love, and it documents the country&apos;s biodiversity in a way
            that&apos;s searchable and accessible.
          </p>
          <p className="text-gray-600 leading-relaxed mt-4">
            If you&apos;re a birder planning a trip, start with the{' '}
            <a href="/species" className="text-amber-600 hover:underline">
              Species
            </a>{' '}
            index. If you know where you&apos;re headed, the{' '}
            <a href="/region" className="text-amber-600 hover:underline">
              Regions
            </a>{' '}
            section will show you what lives there. And if you want to see the full
            geographic spread of the collection, the{' '}
            <a href="/map/costa-rica" className="text-amber-600 hover:underline">
              Costa Rica Photo Map
            </a>{' '}
            pins every geotagged photograph on the landscape.
          </p>
        </section>

        {/* Credentials / facts */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">In Brief</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { label: 'Based in', value: 'Costa Rica' },
              { label: 'Primary territory', value: 'Pacific coast, Osa Peninsula, Central Valley' },
              { label: 'Core subjects', value: 'Birds, wildlife, landscapes' },
              { label: 'Archive size', value: '50,000+ photographs' },
              { label: 'Years in the field', value: '10+' },
              { label: 'Published in', value: 'Travel + outdoor media worldwide' },
            ].map(({ label, value }) => (
              <div key={label} className="border-b border-stone-200 pb-3">
                <dt className="text-sm text-gray-400 uppercase tracking-wide font-medium">{label}</dt>
                <dd className="text-gray-900 font-medium mt-1">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Photography services */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Photography Services</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Beyond the archive, I offer guided photography sessions in the field, custom
            image licensing for editorial and commercial use, and prints on request. If
            you need a specific species, location, or type of image for a project, get
            in touch and I&apos;ll tell you honestly whether I have it or whether it&apos;s
            worth chasing in the field.
          </p>
          <a
            href="mailto:joshua@wildphotography.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition"
          >
            Get in touch
          </a>
        </section>

        {/* Other projects */}
        <section className="border-t pt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Other Projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                name: 'EasyCostaRica.com',
                desc: 'Travel authority covering the whole country — beaches, jungles, volcanoes, and everything in between.',
                url: 'https://easycostarica.com',
              },
              {
                name: 'SurfCostaRica.com',
                desc: 'Surf-specific guide covering breaks, lessons, camps, and the surf lifestyle up and down both coasts.',
                url: 'https://surfcostarica.com',
              },
              {
                name: 'Costa Rica Bird Watchers',
                desc: 'Dedicated birding site with species profiles, hotspot guides, and field-tested itineraries.',
                url: 'https://costaricabirdwatchers.com',
              },
              {
                name: 'NameFocus.com',
                desc: 'Premium domain portfolio — a collection of strategic asset names across travel, nature, and lifestyle.',
                url: 'https://namefocus.com',
              },
            ].map(({ name, desc, url }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 border border-stone-200 rounded-xl hover:border-amber-400 hover:shadow-md transition group"
              >
                <div className="font-bold text-gray-900 group-hover:text-amber-700 transition mb-1">
                  {name}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
