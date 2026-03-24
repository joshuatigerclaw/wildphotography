import Link from 'next/link';
import { Metadata } from 'next';
import { getAllArticles } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Articles & Guides | Wildphotography',
  description: 'Expert photography guides, species profiles, and location guides for Costa Rica wildlife and bird photography by Joshua ten Brink.',
  alternates: {
    canonical: `${SITE_URL}/article`,
  },
  openGraph: {
    title: 'Articles & Guides | Wildphotography',
    description: 'Expert photography guides, species profiles, and location guides for Costa Rica.',
    url: `${SITE_URL}/article`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  species_guide: 'Species Guide',
  location_guide: 'Location Guide',
  photography_guide: 'Photography Guide',
  itinerary: 'Itinerary',
  gear_guide: 'Gear Guide',
  theme_roundup: 'Guide',
};

const ARTICLE_TYPE_COLORS: Record<string, string> = {
  species_guide: 'bg-amber-100 text-amber-800',
  location_guide: 'bg-emerald-100 text-emerald-800',
  photography_guide: 'bg-blue-100 text-blue-800',
  itinerary: 'bg-purple-100 text-purple-800',
  gear_guide: 'bg-gray-100 text-gray-800',
  theme_roundup: 'bg-teal-100 text-teal-800',
};

export default async function ArticleIndexPage() {
  const articles = await getAllArticles();

  // Group articles by type
  const typeGroups: Record<string, typeof articles> = {};
  for (const article of articles) {
    const type = article.articleType || 'other';
    if (!typeGroups[type]) typeGroups[type] = [];
    typeGroups[type].push(article);
  }

  const typeOrder = ['species_guide', 'location_guide', 'photography_guide', 'itinerary', 'gear_guide', 'theme_roundup'];
  const sortedTypes = [
    ...typeOrder.filter(t => typeGroups[t]),
    ...Object.keys(typeGroups).filter(t => !typeOrder.includes(t)),
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">Articles</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Articles & Guides
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Expert photography guides, species profiles, and travel guides for Costa Rica
          — written and photographed by Joshua ten Brink, a resident wildlife photographer.
        </p>
      </header>

      {articles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-xl">No articles published yet. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {sortedTypes.map(type => (
            <section key={type}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${ARTICLE_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'}`}>
                  {ARTICLE_TYPE_LABELS[type] || type}
                </span>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {typeGroups[type].map(article => (
                  <Link
                    key={article.id}
                    href={`/article/${article.slug}`}
                    className="group block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-300"
                  >
                    {/* Featured image */}
                    <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
                      {article.smallUrl || article.mediumUrl ? (
                        <img
                          src={article.smallUrl || article.mediumUrl!}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
                          <span className="text-4xl">📷</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <p className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${ARTICLE_TYPE_COLORS[article.articleType] || 'bg-gray-100 text-gray-600'}`}>
                        {ARTICLE_TYPE_LABELS[article.articleType] || article.articleType}
                      </p>
                      <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
                          {article.excerpt}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 mt-3 text-blue-600 font-medium text-sm group-hover:gap-2 transition-all">
                        Read guide
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
