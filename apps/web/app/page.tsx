import { Metadata } from 'next';
import Link from 'next/link';
import {
  getGalleries,
  getAllPhotos,
  getRandomPhotos,
  getPopularPhotos,
  getAllSpecies,
  getAllArticles,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Wildphotography | Costa Rica Nature Photography',
  description: 'Professional wildlife, bird, and nature photography from Costa Rica. Explore our galleries, purchase prints, or book a photography tour.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Wildphotography | Costa Rica Nature Photography',
    description: 'Professional wildlife and nature photography from Costa Rica.',
    url: SITE_URL,
    siteName: 'Wildphotography',
    locale: 'en_US',
    type: 'website',
  },
};

// Static tour data for affiliate section (GetYourGuide / Viator)
const FEATURED_TOURS = [
  { id: 1, title: 'Monteverde Cloud Forest Birding', operator: 'CR Birding', location: 'Monteverde', days: 3, price_usd: 450, is_partner: true },
  { id: 2, title: 'Arenal Volcano Wildlife Tour', operator: 'Arenal Nature', location: 'Arenal', days: 2, price_usd: 180, is_partner: false },
  { id: 3, title: 'Osa Peninsula Safari', operator: 'Osa Adventures', location: 'Osa Peninsula', days: 5, price_usd: 890, is_partner: true },
  { id: 4, title: 'Carara & Pacific Coast Macaws', operator: 'Pacific Wings', location: 'Carara', days: 4, price_usd: 320, is_partner: false },
];

export default async function Home() {
  const [galleries, recentPhotos, randomPhotos, popularPhotos, species, articles] =
    await Promise.all([
      getGalleries(),
      getAllPhotos(8),
      getRandomPhotos(6),
      getPopularPhotos(8),
      getAllSpecies(),
      getAllArticles(),
    ]);

  const featuredSpecies = species.slice(0, 12);
  const featuredArticles = articles.slice(0, 3);
  const mosaicPhotos = popularPhotos.slice(0, 6);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const issueNum = String(today.getDate()).padStart(2, '0');

  return (
    <div>
      {/* Notice bar */}
      <div className="noticebar">
        Limited 2026 Quetzal Print Edition — <Link href="/prints">Shop the release →</Link>
      </div>

      {/* ─── Hero mosaic ─────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero-head">
            <div>
              <h1 className="hero-title">
                Portraits of the <em>Neotropics</em>, shot on foot.
              </h1>
            </div>
            <div className="hero-meta">
              <div>ISSUE {issueNum} · {dateStr.toUpperCase()}</div>
              <div>{species.length} SPECIES · {galleries.length} REGIONS</div>
              <div style={{ color: 'var(--accent)' }}>— PHOTOGRAPH 284 HOURS THIS YEAR</div>
            </div>
          </div>

          {/* Editorial mosaic grid */}
          {mosaicPhotos.length > 0 ? (
            <div className="mosaic">
              {mosaicPhotos.map((photo, i) => {
                const cls = ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6'][i] || `m-${i + 1}`;
                return (
                  <div key={photo.id} className={`m-cell ${cls}`}>
                    {photo.thumbUrl ? (
                      <img
                        src={photo.thumbUrl}
                        alt={photo.title || 'WildPhotography Costa Rica'}
                        loading={i < 3 ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <div className="ph">No preview</div>
                    )}
                    <div className="buy-row">
                      <Link
                        href={`/photo/${photo.slug}`}
                        className="pill-btn ghost"
                      >
                        ⤢ View
                      </Link>
                      <Link
                        href={`/buy/${photo.slug}`}
                        className="pill-btn"
                      >
                        Buy · $9
                      </Link>
                    </div>
                    <div className="hover-card">
                      <div className="hc-top">
                        <div>
                          <div className="hc-kin">{photo.locationName || photo.region || 'Costa Rica'}</div>
                          <div className="hc-title">{photo.title || photo.slug}</div>
                        </div>
                      </div>
                      <div className="hc-meta">
                        {photo.iso && <span>ISO {photo.iso}</span>}
                        {photo.aperture && <span>{photo.aperture}</span>}
                        {photo.lens && <span>{photo.lens}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ph" style={{ height: 320 }}>No photos available</div>
          )}
        </div>
      </section>

      {/* ─── Tours band ───────────────────────────────────────── */}
      <section className="tours-band">
        <div className="container">
          <div className="tours-head">
            <div>
              <div className="eyebrow" style={{ color: 'var(--accent)' }}>
                Partner Operators · Affiliate
              </div>
              <div className="display" style={{ marginTop: 6 }}>
                Go see them in the wild.
              </div>
              <div className="lede" style={{ marginTop: 10, fontSize: 16 }}>
                Small-group tours with operators I&apos;ve worked with on assignment.
                Booking through these links supports the archive at no extra cost to you.
              </div>
            </div>
            <Link href="/search" className="btn-ghost">All Tours →</Link>
          </div>
          <div className="tours-row">
            {FEATURED_TOURS.map((tour) => (
              <div key={tour.id} className="tour-card">
                <div className="tc-top">
                  <div className="tc-op">{tour.operator}</div>
                  {tour.is_partner && <div className="tc-partner">Partner</div>}
                </div>
                <div className="tc-title">{tour.title}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>
                  {tour.location} · {tour.days} DAYS
                </div>
                <div className="tc-footer">
                  <div>
                    <span className="price">
                      <span className="price-c">from $</span>
                      {tour.price_usd}
                    </span>
                    <div className="tc-days">{tour.days} DAYS</div>
                  </div>
                  <div className="tc-cta">
                    <Link href={`/search?location=${encodeURIComponent(tour.location)}`} style={{ color: 'var(--accent)' }}>
                      Book →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured Species ─────────────────────────────────── */}
      <div className="container">
        <div className="sec-head">
          <div>
            <div className="eyebrow">Species Index · Curated</div>
            <div className="sec-title">
              Twelve recent <em>subjects</em>.
            </div>
            <div style={{ color: 'var(--ink-muted)', marginTop: 8, fontSize: 15 }}>
              The current front of the archive — recently added, recently photographed, or recently reshot in better light.
            </div>
          </div>
          <div className="sec-right">
            {species.length} total species
            <Link href="/species">Open the full index →</Link>
          </div>
        </div>

        {featuredSpecies.length > 0 ? (
          <div className="sp-grid">
            {featuredSpecies.map((s, i) => (
              <div key={i} className="sp-card">
                {s.sampleThumb ? (
                  <Link href={`/species/${s.slug}`}>
                    <img
                      src={s.sampleThumb}
                      alt={s.name || s.slug}
                      loading="lazy"
                    />
                  </Link>
                ) : (
                  <div className="ph" style={{ aspectRatio: '4/3' }}>No preview</div>
                )}
                <div className="sp-info">
                  <div>
                    <div className="sp-name">
                      <Link href={`/species/${s.slug}`} style={{ color: 'inherit' }}>
                        {s.name || s.slug}
                      </Link>
                    </div>
                    {s.scientificName && (
                      <div className="sp-latin">{s.scientificName}</div>
                    )}
                  </div>
                  <div className="sp-count">{s.photoCount} SHOTS</div>
                  <div className="sp-region">
                    <span>Costa Rica</span>
                    <Link href={`/species/${s.slug}`}>View →</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ph" style={{ height: 120, marginTop: 20 }}>No species available</div>
        )}

        {/* ─── Articles ─────────────────────────────────────────── */}
        {featuredArticles.length > 0 && (
          <>
            <div className="sec-head">
              <div>
                <div className="eyebrow">Field Journal</div>
                <div className="sec-title">
                  Notes from the <em>blind</em>.
                </div>
              </div>
              <div className="sec-right">
                <Link href="/article">All dispatches →</Link>
              </div>
            </div>

            <div className="articles-grid">
              {featuredArticles.map((article, i) => (
                <div key={i} className={`article-card ${i === 0 ? 'is-lead' : ''}`}>
                  {article.thumbUrl ? (
                    <img
                      src={article.thumbUrl}
                      alt={article.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="ph" style={{ aspectRatio: '16/9' }}>No image</div>
                  )}
                  <div className="a-kin">{article.articleType || 'Field Notes'}</div>
                  <div className="a-title">{article.title}</div>
                  {article.excerpt && (
                    <div className="a-dek">{article.excerpt.slice(0, 100)}…</div>
                  )}
                  <div className="a-meta">
                    {article.publishedAt
                      ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '2026'}
                    · {article.metadata?.readTime || 5} MIN READ
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Galleries strip ──────────────────────────────────── */}
      {galleries.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <div className="container">
            <div className="sec-head" style={{ marginTop: 32 }}>
              <div>
                <div className="eyebrow">Galleries</div>
                <div className="sec-title">
                  Explore by <em>location</em>.
                </div>
              </div>
              <div className="sec-right">
                <Link href="/galleries">All galleries →</Link>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
              marginTop: 20
            }}>
              {galleries.slice(0, 8).map((gallery) => (
                <Link
                  key={gallery.id}
                  href={`/gallery/${gallery.slug}`}
                  style={{
                    display: 'block',
                    border: '1px solid var(--rule)',
                    borderRadius: 'var(--r-md)',
                    overflow: 'hidden',
                    textDecoration: 'none',
                  }}
                >
                  {gallery.coverPhotoUrl ? (
                    <img
                      src={gallery.coverPhotoUrl}
                      alt={gallery.name || gallery.slug}
                      style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <div className="ph" style={{ aspectRatio: '16/9' }}>No preview</div>
                  )}
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>
                      {gallery.name || gallery.slug}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-dim)', marginTop: 6 }}>
                      {gallery.photoCount} photos
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}