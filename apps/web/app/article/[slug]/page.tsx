import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getRelatedArticles, getLocationIdBySlug, getAffiliateBlocksForEntity } from '@/lib/db';
import AffiliateBlock from '@/components/AffiliateBlock';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: 'Article Not Found | Wildphotography' };

  const canonical = `${SITE_URL}/article/${article.slug}`;
  return {
    title: `${article.title} | Wildphotography`,
    description: article.excerpt || undefined,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description: article.excerpt || undefined,
      url: canonical,
      siteName: 'Wildphotography',
      type: 'article',
      images: article.smallUrl ? [{ url: article.smallUrl }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || undefined,
    },
  };
}

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  species_guide: 'Species Guide',
  location_guide: 'Location Guide',
  photography_guide: 'Photography Guide',
  itinerary: 'Itinerary',
  gear_guide: 'Gear Guide',
  theme_roundup: 'Guide',
};

export default async function ArticlePage({ params }: Props) {
  const [article, relatedArticles] = await Promise.all([
    getArticleBySlug(params.slug),
    getRelatedArticles(params.slug, undefined, 3),
  ]);

  if (!article) notFound();

  const canonical = `${SITE_URL}/article/${article.slug}`;
  const ogImage = article.smallUrl || article.mediumUrl || '';

  // Parse location_links from metadata to find affiliate blocks
  let affiliateBlocks: Awaited<ReturnType<typeof getAffiliateBlocksForEntity>> = [];
  try {
    const meta = typeof article.metadata === 'string' ? JSON.parse(article.metadata) : article.metadata;
    if (meta?.location_links && Array.isArray(meta.location_links) && meta.location_links.length > 0) {
      for (const locLink of meta.location_links) {
        const locId = await getLocationIdBySlug(locLink.slug);
        if (locId) {
          const blocks = await getAffiliateBlocksForEntity('location', locId);
          if (blocks.length > 0) {
            affiliateBlocks = blocks;
            break; // use first matched location
          }
        }
      }
    }
  } catch {
    // no-op: affiliate blocks are optional
  }

  return (
    <article className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link href="/article" className="text-blue-600 hover:underline">Articles</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600 capitalize" aria-current="page">
            {ARTICLE_TYPE_LABELS[article.articleType] || article.articleType}
          </li>
        </ol>
      </nav>

      {/* Featured image */}
      {ogImage && (
        <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-8 shadow-lg">
          <img
            src={ogImage}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Article header */}
      <header className="mb-8">
        <p className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wide mb-4">
          {ARTICLE_TYPE_LABELS[article.articleType] || article.articleType}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="text-xl text-gray-500 leading-relaxed border-b border-gray-200 pb-6">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 mt-4 text-gray-500 text-sm">
          <span>By Joshua ten Brink</span>
          <span>·</span>
          <span>Wildlife Photographer, Costa Rica</span>
        </div>
      </header>

      {/* Article body */}
      {article.content ? (
        <div
          className="article-body prose prose-lg max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      ) : (
        <p className="text-gray-500 italic">Article content coming soon.</p>
      )}

      {/* Book a Tour — Affiliate Blocks */}
      {affiliateBlocks.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Book a Tour</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {affiliateBlocks.map(block => (
              <AffiliateBlock
                key={block.id}
                entityType={block.entityType as any}
                entityId={block.entityId}
                provider={block.provider as any}
                title={block.title || 'Book Tours'}
                destinationKey={block.destinationKey || undefined}
                shortcode={block.shortcode || undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <section className="mt-16 pt-8 border-t-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">More Guides</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {relatedArticles.map(related => (
              <Link
                key={related.id}
                href={`/article/${related.slug}`}
                className="group block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-300"
              >
                <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
                  {related.smallUrl || related.mediumUrl ? (
                    <img
                      src={related.smallUrl || related.mediumUrl!}
                      alt={related.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
                      <span className="text-3xl">📷</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                    {ARTICLE_TYPE_LABELS[related.articleType] || related.articleType}
                  </p>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                    {related.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>

          {/* Back to all articles */}
          <div className="mt-8 text-center">
            <Link
              href="/article"
              className="inline-flex items-center gap-2 text-blue-600 font-medium hover:gap-3 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              View all articles
            </Link>
          </div>
        </section>
      )}
    </article>
  );
}
