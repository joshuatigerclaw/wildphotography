'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState({
    keywords: [] as string[],
    galleries: [] as string[],
    locations: [] as string[],
    years: [] as number[],
  });
  
  // Facet filters
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  useEffect(() => {
    async function search() {
      if (!query) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      
      try {
        // TODO: Replace with actual Typesense search
        // For now, return mock data
        await new Promise(r => setTimeout(r, 500));
        
        const mockResults = [
          { id: '1', title: 'Scarlet Macaw', slug: 'scarlet-macaw', keywords: ['birds', 'macaw'], gallery: 'birds', location: 'Carara', thumb_url: '' },
          { id: '2', title: 'Resplendent Quetzal', slug: 'resplendent-quetzal', keywords: ['birds', 'quetzal'], gallery: 'birds', location: 'Monteverde', thumb_url: '' },
          { id: '3', title: 'Toucan', slug: 'toucan', keywords: ['birds', 'toucan'], gallery: 'birds', location: 'Manuel Antonio', thumb_url: '' },
        ].filter(r => r.title.toLowerCase().includes(query.toLowerCase()));
        
        setResults(mockResults);
        
        // Mock facets
        setFacets({
          keywords: ['birds', 'macaw', 'quetzal', 'toucan'],
          galleries: ['birds', 'landscapes', 'wildlife'],
          locations: ['Carara', 'Monteverde', 'Manuel Antonio'],
          years: [2024, 2023, 2022],
        });
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }
    
    search();
  }, [query, selectedKeyword, selectedGallery, selectedLocation, selectedYear]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Search Photos</h1>
      
      {/* Search input */}
      <form className="mb-8">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by keyword, location, camera..."
          className="w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </form>
      
      {query && (
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Facets sidebar */}
          <aside className="lg:col-span-1">
            {/* Keywords */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Keywords</h3>
              <div className="space-y-1">
                {facets.keywords.map(kw => (
                  <button
                    key={kw}
                    onClick={() => setSelectedKeyword(selectedKeyword === kw ? null : kw)}
                    className={`block text-left w-full px-2 py-1 rounded text-sm ${
                      selectedKeyword === kw ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Galleries */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Galleries</h3>
              <div className="space-y-1">
                {facets.galleries.map(gal => (
                  <button
                    key={gal}
                    onClick={() => setSelectedGallery(selectedGallery === gal ? null : gal)}
                    className={`block text-left w-full px-2 py-1 rounded text-sm ${
                      selectedGallery === gal ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {gal}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Locations */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Location</h3>
              <div className="space-y-1">
                {facets.locations.map(loc => (
                  <button
                    key={loc}
                    onClick={() => setSelectedLocation(selectedLocation === loc ? null : loc)}
                    className={`block text-left w-full px-2 py-1 rounded text-sm ${
                      selectedLocation === loc ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Years */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Year</h3>
              <div className="space-y-1">
                {facets.years.map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(selectedYear === year ? null : year)}
                    className={`block text-left w-full px-2 py-1 rounded text-sm ${
                      selectedYear === year ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </aside>
          
          {/* Results */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Searching...</p>
              </div>
            ) : results.length > 0 ? (
              <>
                <p className="text-gray-500 mb-4">{results.length} results for "{query}"</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {results.map(photo => (
                    <Link 
                      key={photo.id}
                      href={`/p/${photo.slug}`}
                      className="block aspect-square bg-gray-200 rounded-lg overflow-hidden hover:opacity-90 transition"
                    >
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        📷
                      </div>
                      <div className="p-2">
                        <h3 className="font-medium text-sm truncate">{photo.title}</h3>
                        <p className="text-xs text-gray-500">{photo.location}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No results found for "{query}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
