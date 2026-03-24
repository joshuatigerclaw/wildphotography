import Link from 'next/link';
import { Metadata } from 'next';
import { getAllSpecies } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Bird & Wildlife Species | Wildphotography',
  description: 'Browse our collection of bird and wildlife species photographed in Costa Rica. From hummingbirds to macaws, toucans to quetzals.',
  alternates: {
    canonical: `${SITE_URL}/species`,
  },
  openGraph: {
    title: 'Bird & Wildlife Species | Wildphotography',
    description: 'Browse our collection of bird and wildlife species photographed in Costa Rica.',
    url: `${SITE_URL}/species`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

export default async function SpeciesPage() {
  const species = await getAllSpecies();
  
  // Group species by first letter for easier navigation
  const grouped = species.reduce((acc, s) => {
    const letter = s.name.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(s);
    return acc;
  }, {} as Record<string, typeof species>);
  
  const letters = Object.keys(grouped).sort();

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">Species</li>
        </ol>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Bird & Wildlife Species
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          Explore {species.length} species captured in Costa Rica through our photography. 
          From tiny hummingbirds to majestic macaws.
        </p>
      </header>
      
      {species.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No species data available yet.</p>
        </div>
      ) : (
        <>
          {/* Quick letter navigation */}
          <div className="flex flex-wrap gap-2 mb-8 pb-4 border-b">
            {letters.map(letter => (
              <a 
                key={letter}
                href={`#letter-${letter}`}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 font-medium text-sm transition"
              >
                {letter}
              </a>
            ))}
          </div>
          
          {/* Species grid by letter */}
          <div className="space-y-8">
            {letters.map(letter => (
              <section key={letter} id={`letter-${letter}`}>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg">
                    {letter}
                  </span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {grouped[letter].map((s) => (
                    <Link 
                      key={`${s.name}-${s.scientificName || 'no-sci'}`}
                      href={`/species/${s.slug}`}
                      className="group block"
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                        {s.sampleThumb ? (
                          <img 
                            src={s.sampleThumb}
                            alt={s.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-300">
                            <span className="text-3xl">🦜</span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition text-sm">
                        {s.name}
                      </h3>
                      {s.scientificName && (
                        <p className="text-gray-500 text-xs italic">
                          {s.scientificName}
                        </p>
                      )}
                      <p className="text-gray-500 text-xs">
                        {s.photoCount} photo{s.photoCount !== 1 ? 's' : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
