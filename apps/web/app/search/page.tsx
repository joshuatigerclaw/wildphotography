import { Metadata } from 'next';
import SearchClient from './SearchClient';

const SITE_URL = 'https://wildphotography.com';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q = '' } = await searchParams;
  const canonical = q ? `${SITE_URL}/search?q=${encodeURIComponent(q)}` : `${SITE_URL}/search`;

  return {
    title: q ? `Search: ${q} | WildPhotography` : 'Search Photos | WildPhotography',
    description: q
      ? `Search results for "${q}" — browse ${q} wildlife and nature photos from Costa Rica by Joshua ten Brink.`
      : 'Search thousands of wildlife and nature photos from Costa Rica.',
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: {
      title: q ? `Search: ${q} | WildPhotography` : 'Search Photos | WildPhotography',
      description: q ? `WildPhotography search results for "${q}"` : 'Search WildPhotography Costa Rica archive',
      url: canonical,
      siteName: 'WildPhotography',
      type: 'website',
    },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const canonical = q ? `${SITE_URL}/search?q=${encodeURIComponent(q)}` : `${SITE_URL}/search`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    name: `WildPhotography search: ${q || 'all photos'}`,
    description: q
      ? `Search results for "${q}" on WildPhotography — professional wildlife and nature photography from Costa Rica by Joshua ten Brink.`
      : 'Search the WildPhotography archive — professional wildlife and nature photography from Costa Rica.',
    url: canonical,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SearchClient initialQuery={q} />
    </>
  );
}