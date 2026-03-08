import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Mock search data
const mockPhotos = [
  { id: '1', slug: 'scarlet-macaw', title: 'Scarlet Macaw', thumbUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400', smallUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800', mediumUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200', largeUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3', locationName: 'Carara', keywords: ['macaw', 'parrot', 'tropical', 'bird'] },
  { id: '2', slug: 'quetzal', title: 'Resplendent Quetzal', thumbUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400', smallUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=800', mediumUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1200', largeUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731', locationName: 'Monteverde', keywords: ['quetzal', 'bird', 'cloud-forest'] },
  { id: '3', slug: 'toucan', title: 'Keel-billed Toucan', thumbUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400', smallUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=800', mediumUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1200', largeUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587', locationName: 'Manuel Antonio', keywords: ['toucan', 'tropical', 'bird'] },
  { id: '4', slug: 'sloth', title: 'Three-toed Sloth', thumbUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400', smallUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=800', mediumUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1200', largeUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4', locationName: 'Manuel Antonio', keywords: ['sloth', 'mammal', 'wildlife'] },
  { id: '5', slug: 'monkey', title: 'Capuchin Monkey', thumbUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400', smallUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=800', mediumUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1200', largeUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9', locationName: 'Corcovado', keywords: ['monkey', 'primate', 'wildlife'] },
  { id: '6', slug: 'iguana', title: 'Green Iguana', thumbUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400', smallUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800', mediumUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1200', largeUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62', locationName: 'Tortuguero', keywords: ['iguana', 'reptile', 'tropical'] },
  { id: '7', slug: 'butterfly', title: 'Blue Morpho', thumbUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400', smallUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=800', mediumUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=1200', largeUrl: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890', locationName: 'La Selva', keywords: ['butterfly', 'morpho', 'insect'] },
  { id: '8', slug: 'owl', title: 'Spectacled Owl', thumbUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=400', smallUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=800', mediumUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf?w=1200', largeUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4c0283cf', locationName: 'Monteverde', keywords: ['owl', 'bird', 'nocturnal'] },
  { id: '9', slug: 'toucan-barbet', title: 'Toucan Barbet', thumbUrl: 'https://images.unsplash.com/photo-1557166983-593964444d89?w=400', smallUrl: 'https://images.unsplash.com/photo-1557166983-593964444d89?w=800', mediumUrl: 'https://images.unsplash.com/photo-1557166983-593964444d89?w=1200', largeUrl: 'https://images.unsplash.com/photo-1557166983-593964444d89', locationName: 'Costa Rica', keywords: ['toucan', 'barbet', 'bird'] },
  { id: '10', slug: 'hummingbird', title: 'Rufous-tailed Hummingbird', thumbUrl: 'https://images.unsplash.com/photo-1551085254-e96b210db58a?w=400', smallUrl: 'https://images.unsplash.com/photo-1551085254-e96b210db58a?w=800', mediumUrl: 'https://images.unsplash.com/photo-1551085254-e96b210db58a?w=1200', largeUrl: 'https://images.unsplash.com/photo-1551085254-e96b210db58a', locationName: 'Costa Rica', keywords: ['hummingbird', 'bird', 'tiny'] },
];

function searchPhotos(query: string): typeof mockPhotos {
  const q = query.toLowerCase();
  return mockPhotos.filter(photo => 
    photo.title.toLowerCase().includes(q) ||
    photo.locationName?.toLowerCase().includes(q) ||
    photo.keywords.some(k => k.toLowerCase().includes(q))
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!query.trim()) {
    return NextResponse.json({
      photos: [],
      total: 0,
      hasMore: false,
    });
  }

  try {
    // Search in mock data (replace with DB query in production)
    const results = searchPhotos(query);
    const total = results.length;
    const hasMore = offset + limit < total;
    const photos = results.slice(offset, offset + limit);

    return NextResponse.json({
      photos,
      total,
      hasMore,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
