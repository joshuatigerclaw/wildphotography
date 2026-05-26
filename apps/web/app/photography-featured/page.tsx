import { Metadata } from 'next';
import { sql } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Photography Featured in Travel, News & Editorial Publications | Wildphotography',
  description: "Joshua ten Brink's Costa Rica photography has been licensed, credited, and featured across travel, news, editorial, and commercial publications. This page documents selected examples of published work and media usage.",
  alternates: {
    canonical: '/photography-featured',
  },
  openGraph: {
    title: 'Photography Featured in Travel, News & Editorial Publications',
    description: "Joshua ten Brink's Costa Rica photography has been licensed, credited, and featured across travel, news, editorial, and commercial publications.",
    url: `${SITE_URL}/photography-featured`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

type FeaturedItem = {
  publication: string;
  article_title: string;
  url: string | null;
  topic: string;
  credit_status: string;
};

async function getFeaturedItems(): Promise<FeaturedItem[]> {
  try {
    const result = await sql`
      SELECT publication, article_title, url, topic, credit_status
      FROM featured_publications
      WHERE active = true
      ORDER BY featured_order ASC NULLS LAST, id ASC
      LIMIT 50
    `;
    return result as FeaturedItem[];
  } catch (e) {
    // Table may not exist yet — return empty
    return [];
  }
}

export default async function PhotographyFeaturedPage() {
  const items = await getFeaturedItems();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['CollectionPage', 'ProfilePage'],
    name: 'Photography Featured in Travel, News & Editorial Publications',
    description: "Joshua ten Brink's Costa Rica photography has been licensed, credited, and featured across travel, news, editorial, and commercial publications.",
    url: `${SITE_URL}/photography-featured`,
    author: {
      '@type': 'Person',
      name: 'Joshua ten Brink',
      alternateName: ['Joshua Ten Brink', 'Josh ten Brink'],
      url: SITE_URL,
      jobTitle: 'Wildlife Photographer',
      worksFor: {
        '@type': 'Organization',
        name: 'WildPhotography',
        url: SITE_URL,
      },
      sameAs: [
        'https://www.instagram.com/wildphotography/',
        'https://www.pinterest.com/wildphotography/',
      ],
    },
    mainEntity: {
      '@type': 'CreativeWork',
      name: 'Photography Featured in Travel, News & Editorial Publications',
      author: {
        '@type': 'Person',
        name: 'Joshua ten Brink',
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--gutter) var(--gutter) calc(var(--gutter) * 3)' }}>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--gutter)', fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-dim)' }}>
          <ol style={{ display: 'flex', alignItems: 'center', gap: '10px', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
            <li><a href="/" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>Home</a></li>
            <li>/</li>
            <li style={{ color: 'var(--ink-muted)' }}>Featured Publications</li>
          </ol>
        </nav>

        {/* Page Header */}
        <header style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1, margin: '0 0 20px 0', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
            Photography Featured in Travel, News & Editorial Publications
          </h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '17px', lineHeight: 1.6, maxWidth: '640px', margin: 0 }}>
            Joshua ten Brink&apos;s Costa Rica photography has been licensed, credited, and featured across travel, news, editorial, and commercial publications. This page documents selected examples of published work and media usage.
          </p>
        </header>

        {/* Featured Publications Table */}
        {items.length > 0 ? (
          <div style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--ink)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600 }}>Publication / Site</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600 }}>Article Title</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600 }}>Topic</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ padding: '14px 16px', color: 'var(--ink)' }}>{item.publication}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.2)' }}>
                          {item.article_title}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--ink-muted)' }}>{item.article_title}</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--ink-muted)', fontSize: '13px' }}>{item.topic}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: item.credit_status === 'credited'
                          ? 'rgba(0,128,0,0.1)'
                          : item.credit_status === 'licensed'
                          ? 'rgba(0,80,200,0.1)'
                          : 'rgba(0,0,0,0.05)',
                        color: item.credit_status === 'credited'
                          ? 'rgb(0,100,0)'
                          : item.credit_status === 'licensed'
                          ? 'rgb(0,60,180)'
                          : 'var(--ink-muted)',
                      }}>
                        {item.credit_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: '12px', marginBottom: 'calc(var(--gutter) * 2)' }}>
            <p style={{ fontSize: '15px' }}>
              Featured publication records will appear here as they are documented.
            </p>
          </div>
        )}

        {/* About the photographer */}
        <section style={{ marginTop: 'calc(var(--gutter) * 2)', padding: '32px', background: 'rgba(0,0,0,0.03)', borderRadius: '16px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.4rem', marginBottom: '16px' }}>About the Photographer</h2>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.7, fontSize: '15px', margin: 0 }}>
            Joshua ten Brink is a Costa Rica–based wildlife and travel photographer with over two decades of experience documenting the country&apos;s natural beauty. His work spans national parks, private reserves, beaches, and remote wildlife habitats across all seven provinces. All photographs are available for editorial licensing, commercial licensing, and print purchase through WildPhotography.com.
          </p>
        </section>

      </div>
    </>
  );
}