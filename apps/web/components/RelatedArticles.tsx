import Link from 'next/link';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const sql = neon(DATABASE_URL);

function withR2(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  article_type: string;
  thumb_url: string | null;
}

interface RelatedArticlesProps {
  sourceType: 'species' | 'location' | 'article' | 'gallery';
  sourceId: number;
  /** Override title shown above the section */
  title?: string;
  /** Max articles to show, default 3 */
  limit?: number;
}

const TYPE_LABELS: Record<string, string> = {
  species: 'species guide',
  location: 'location guide',
  article: 'related article',
  gallery: 'gallery guide',
};

export async function RelatedArticles({
  sourceType,
  sourceId,
  title,
  limit = 3,
}: RelatedArticlesProps) {
  const articlesResult = await sql`
    SELECT a.id, a.title, a.slug, a.excerpt, a.article_type,
           p.thumb_url
    FROM content_articles a
    JOIN page_links pl ON pl.target_id = a.id AND pl.target_type = 'article'
    LEFT JOIN photos p ON p.id = a.featured_photo_id
    WHERE pl.source_type = ${sourceType}
      AND pl.source_id = ${sourceId}
      AND a.status = 'published'
    ORDER BY pl.weight DESC NULLS LAST, a.published_at DESC NULLS LAST
    LIMIT ${limit}
  `;

  const articles = articlesResult as ArticleRow[];

  if (articles.length === 0) {
    return null;
  }

  return (
    <section>
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      )}
      <div className="space-y-3">
        {articles.map(article => (
          <Link
            key={article.id}
            href={`/article/${article.slug}`}
            className="flex gap-4 p-4 border rounded-xl hover:border-blue-400 hover:shadow-sm transition-all group"
          >
            {article.thumb_url && (
              <div className="shrink-0 w-20 h-16 rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={withR2(article.thumb_url) ?? ''}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                {TYPE_LABELS[article.article_type] || article.article_type}
              </span>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate mt-0.5">
                {article.title}
              </h3>
              {article.excerpt && (
                <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                  {article.excerpt}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default RelatedArticles;
