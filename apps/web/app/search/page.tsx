'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface PhotoRow {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string | null;
  locationName: string | null;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searched, setSearched] = useState(false);

  const limit = 50;

  const performSearch = useCallback(async (searchQuery: string, currentOffset: number = 0) => {
    if (!searchQuery.trim()) {
      setPhotos([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: String(limit),
        offset: String(currentOffset),
      });

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      if (currentOffset === 0) {
        setPhotos(data.photos || []);
      } else {
        setPhotos(prev => [...(prev || []), ...(data.photos || [])]);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setOffset(currentOffset + limit);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      performSearch(query, offset);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Search Photos</h1>        
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search birds, wildlife, locations..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Search
          </button>
        </form>
      </header>

      {searched && (
        <div className="mb-4 text-gray-600">
          {total > 0 ? (
            <p>Found {total.toLocaleString()} photos matching "{query}"</p>
          ) : (
            <p>No photos found matching "{query}"</p>
          )}
        </div>
      )}

      {photos.length > 0 ? (
        <div>
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
                <h3 className="text-sm font-medium mt-1 group-hover:text-blue-600 truncate">
                  {photo.title}
                </h3>
                {photo.locationName && (
                  <p className="text-xs text-gray-500">{photo.locationName}</p>
                )}
              </a>
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      ) : (
        !loading && searched && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No results found</p>
            <p className="text-sm mt-2">Try a different search term</p>
          </div>
        )
      )}

      {!searched && !loading && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Enter a search term to find photos</p>
          <p className="text-sm mt-2">Search for birds, animals, locations, or keywords</p>
        </div>
      )}
    </>
  );
}

function SearchLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Search Photos</h1>
        <div className="h-10 w-64 bg-gray-200 animate-pulse rounded-lg" />
      </header>
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <a href="/" className="text-blue-600 hover:underline">Home</a>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Search</span>
      </nav>
      
      <Suspense fallback={<SearchLoading />}>
        <SearchContent />
      </Suspense>
    </div>
  );
}
