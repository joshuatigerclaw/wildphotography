import { Metadata } from 'next';
import { neon } from '@neondatabase/serverless';
import SiteFooter from '@/components/editorial/SiteFooter';
import Masthead from '@/components/editorial/Masthead';

const SITE_URL = 'https://wildphotography.com';
const dbUrl = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

export const metadata: Metadata = {
  title: 'Websites Featuring Photography by Joshua ten Brink',
  description:
    'Public websites and publications where photography by Joshua ten Brink has been credited or featured.',
  alternates: {
    canonical: `${SITE_URL}/photography-featured`,
  },
  openGraph: {
    title: 'Websites Featuring Photography by Joshua ten Brink',
    description:
      'Public websites and publications where photography by Joshua ten Brink has been credited or featured.',
    url: `${SITE_URL}/photography-featured`,
  },
};

export default async function PhotographyFeaturedPage() {
  const sql = neon(dbUrl);
  const credits = await sql(`
    SELECT site_name, article_title, source_url, domain, first_found_at
    FROM photo_usage_credits
    WHERE status = 'verified' AND published = true
    ORDER BY site_name ASC, article_title ASC
    LIMIT 200
  `);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Websites Featuring Photography by Joshua ten Brink',
        url: `${SITE_URL}/photography-featured`,
        description:
          'Public websites and publications where photography by Joshua ten Brink has been credited or featured.',
        about: 'Joshua ten Brink photography credits',
        mainEntity: {
          '@type': 'ItemList',
          name: 'Websites Featuring Photography by Joshua ten Brink',
          itemListElement: credits.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'CreativeWork',
              name: c.article_title,
              url: c.source_url,
              publisher: {
                '@type': 'Organization',
                name: c.site_name,
                url: `https://${c.domain}`,
              },
              creditText: 'Photography by Joshua ten Brink',
            },
          })),
        },
      },
      {
        '@type': 'Person',
        name: 'Joshua ten Brink',
        url: `${SITE_URL}/about`,
        sameAs: [
          'https://www.linkedin.com/in/joshuatenbrink/',
          'https://joshuatenbrink.com/',
          'https://photoquest.com/',
          'https://easycostarica.com/',
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Photography Featured',
            item: `${SITE_URL}/photography-featured`,
          },
        ],
      },
    ],
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ink)',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Masthead />
      <main
        style={{
          flex: 1,
          padding: 'var(--gutter) var(--gutter)',
          maxWidth: '960px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            color: 'var(--ink-dim)',
            marginBottom: 'calc(var(--gutter) * 2)',
          }}
        >
          <ol
            style={{
              display: 'flex',
              gap: '8px',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            <li>
              <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                Home
              </a>
            </li>
            <li>/</li>
            <li style={{ color: 'var(--accent)' }}>Photography Featured</li>
          </ol>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: '48px' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '.15em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: '16px',
            }}
          >
            External Credits
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 700,
              lineHeight: 1.1,
              color: 'var(--paper)',
              marginBottom: '20px',
            }}
          >
            Websites Featuring Photography by Joshua ten Brink
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '17px',
              lineHeight: 1.7,
              color: 'var(--ink-dim)',
              maxWidth: '640px',
              marginBottom: '24px',
            }}
          >
            This page highlights public websites and publications where
            photography by Joshua ten Brink has been credited or featured.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
            }}
          >
            Photography credited across travel, editorial, tourism, and media
            websites.
          </p>
        </header>

        {/* Table */}
        {credits.length === 0 ? (
          <div
            style={{
              padding: '60px 0',
              textAlign: 'center',
              fontFamily: 'var(--font-serif)',
              color: 'var(--ink-dim)',
              fontSize: '16px',
            }}
          >
            No verified credits yet. Run the discovery script to begin building
            this index.
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--rule)',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--rule)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <th
                    style={{
                      padding: '14px 20px',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-dim)',
                      fontWeight: 400,
                    }}
                  >
                    Site
                  </th>
                  <th
                    style={{
                      padding: '14px 20px',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-dim)',
                      fontWeight: 400,
                    }}
                  >
                    Article Title
                  </th>
                </tr>
              </thead>
              <tbody>
                {credits.map((credit) => (
                  <tr
                    key={credit.source_url}
                    style={{
                      borderBottom: '1px solid var(--rule)',
                    }}
                  >
                    <td
                      style={{
                        padding: '14px 20px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: 'var(--ink-dim)',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'top',
                      }}
                    >
                      {credit.site_name || credit.domain}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <a
                        href={credit.source_url}
                        target="_blank"
                        rel="nofollow noopener"
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '15px',
                          color: 'var(--accent)',
                          textDecoration: 'none',
                          lineHeight: 1.5,
                          display: 'block',
                        }}
                      >
                        {credit.article_title}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
