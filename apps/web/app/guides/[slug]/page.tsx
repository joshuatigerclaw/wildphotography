import { Metadata } from 'next';
import Link from 'next/link';
import { sql } from '@/lib/db';

const SITE_URL = 'https://wildphotography.com';
const R2_PUBLIC = 'https://images.wildphotography.com';

export const dynamic = 'force-dynamic';

type GuidePhoto = {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string;
  species: string | null;
  locationName: string | null;
};

function withR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Wildlife Photography in Costa Rica — Tips, Locations & Best Practices',
    description: 'A practical guide to wildlife photography in Costa Rica. Learn when and where to photograph jaguars, sloths, tapirs, and other iconic species, plus gear recommendations and ethical guidelines.',
    alternates: { canonical: '/guides/costa-rica-wildlife-photography' },
    openGraph: {
      title: 'Wildlife Photography in Costa Rica — Tips, Locations & Best Practices',
      description: 'A practical guide to wildlife photography in Costa Rica.',
      url: `${SITE_URL}/guides/costa-rica-wildlife-photography`,
      siteName: 'Wildphotography',
      type: 'article',
    },
  };
}

async function getPhotos(): Promise<GuidePhoto[]> {
  try {
    const result = await sql`
      SELECT DISTINCT ON (p.id)
        p.id, p.slug, p.title,
        p.thumb_url, p.small_url,
        p.species_common_name,
        p.location_name
      FROM photos p
      JOIN gallery_photos gp ON gp.photo_id = p.id
      JOIN galleries g ON g.id = gp.gallery_id
      WHERE p.is_active = true
        AND p.ready_for_public_render = true
        AND g.slug IN ('wildlife', 'mammals', 'jaguar', 'tapir', 'sloth', 'monkey')
        AND p.thumb_url IS NOT NULL
      ORDER BY p.id
      LIMIT 12
    `;
    return (result as any[]).map((r: any) => ({
      id: String(r.id),
      slug: r.slug || '',
      title: r.title || r.slug || '',
      thumbUrl: withR2(r.small_url || r.thumb_url) || '',
      species: r.species_common_name || null,
      locationName: r.location_name || null,
    }));
  } catch (e) {
    return [];
  }
}

async function getRelatedGalleries() {
  try {
    const result = await sql`
      SELECT slug, name FROM galleries
      WHERE slug IN ('wildlife', 'mammals', 'jaguar', 'tapir', 'sloth', 'monkey', 'coatimundi')
        AND is_active = true
      LIMIT 8
    `;
    return result as { slug: string; name: string }[];
  } catch (e) {
    return [];
  }
}

async function getRelatedLocations() {
  try {
    const result = await sql`
      SELECT slug, name FROM locations
      WHERE is_active = true AND slug IN ('corcovado', 'tortuguero', 'manuel-antonio', 'arenak')
      LIMIT 4
    `;
    return result as { slug: string; name: string }[];
  } catch (e) {
    return [];
  }
}

export default async function WildlifePhotographyGuidePage() {
  const [photos, galleries, locations] = await Promise.all([
    getPhotos(),
    getRelatedGalleries(),
    getRelatedLocations(),
  ]);

  const hasEnoughPhotos = photos.length >= 6;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    name: 'Wildlife Photography in Costa Rica — Tips, Locations & Best Practices',
    description: 'A practical guide to wildlife photography in Costa Rica.',
    url: `${SITE_URL}/guides/costa-rica-wildlife-photography`,
    author: { '@type': 'Person', name: 'Joshua ten Brink' },
    publisher: { '@type': 'Organization', name: 'WildPhotography', url: SITE_URL },
    datePublished: '2026-05-05',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {!hasEnoughPhotos && (
        <meta name="robots" content="noindex" />
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--gutter) var(--gutter) calc(var(--gutter) * 3)' }}>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--gutter)', fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-dim)' }}>
          <ol style={{ display: 'flex', alignItems: 'center', gap: '10px', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
            <li><a href="/" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>Home</a></li>
            <li>/</li>
            <li><a href="/guides" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>Photography Guides</a></li>
            <li>/</li>
            <li style={{ color: 'var(--ink-muted)' }}>Wildlife Photography</li>
          </ol>
        </nav>

        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1, margin: '0 0 20px 0', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
          Wildlife Photography in Costa Rica
        </h1>

        <p style={{ color: 'var(--ink-muted)', fontSize: '17px', lineHeight: 1.7, maxWidth: '680px', margin: '0 0 32px 0' }}>
          Costa Rica harbors one of the highest densities of wildlife per square kilometer on earth. From the rainforests of Corcovado to the wetlands of Tortuguero, the country offers unmatched opportunities to photograph mammals in their natural habitat — often within meters of trails and observation platforms.
        </p>

        {/* Photo grid */}
        {photos.length > 0 ? (
          <div style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {photos.map(photo => (
                <Link
                  key={photo.id}
                  href={`/photo/${photo.slug}`}
                  style={{ display: 'block', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', textDecoration: 'none' }}
                >
                  <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                    {photo.thumbUrl && (
                      <img
                        src={photo.thumbUrl}
                        alt={photo.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div style={{ padding: '10px 12px', background: 'white' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.title}</p>
                    {photo.locationName && <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--ink-muted)' }}>{photo.locationName}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height: '200px', background: 'rgba(0,0,0,0.04)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)', marginBottom: 'calc(var(--gutter) * 2)', fontSize: '14px' }}>
            Wildlife photos coming soon
          </div>
        )}

        {/* Content sections */}
        <section style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.5rem', marginBottom: '16px', color: 'var(--ink)' }}>Where to Go</h2>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.7, marginBottom: '20px' }}>
            The Osa Peninsula and Corcovado National Park hold the highest species diversity. The probability of photographing white-lipped peccaries, tapirs, and jaguar tracks here is higher than anywhere else in Central America. Tortuguero offers exceptional canal-based photography for caiman, river otters, and anteaters. The Central Valley mountains provide reliable tapir sightings near Braulio Carrillo.
          </p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.7 }}>
            For three-toed sloths and mantled howler monkeys, the trails around Manuel Antonio and San Jos&eacute; areas require minimal travel. Night walks in Monteverde reveal olingos, kinkajous, and two-toed sloths with a guide who knows the territory.
          </p>
        </section>

        <section style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.5rem', marginBottom: '16px', color: 'var(--ink)' }}>When to Go</h2>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.7 }}>
            The dry season from December through April gives the easiest access to forest trails and wildlife congregation at water holes. However, the green season (May–November) brings dramatic lighting, fewer visitors, and active breeding behavior. Jaguar sightings peak during the dry months near water sources on the Osa Peninsula.
          </p>
        </section>

        <section style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.5rem', marginBottom: '16px', color: 'var(--ink)' }}>Essential Gear</h2>
          <ul style={{ color: 'var(--ink-muted)', lineHeight: 1.8, paddingLeft: '20px', margin: 0 }}>
            <li>A 400mm–600mm telephoto lens for distant subjects; a 100–400mm covers most situations when combined with a cropped sensor body.</li>
            <li>A bean bag or gimbal head for vehicle-based shooting — particularly useful on boat tours in Tortuguero and Corcovado.</li>
            <li>Longer 800mm lenses for sharp sloth photography from canopy towers.</li>
            <li>Weather-sealed camera bodies; tropical rain arrives without warning in any month.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.5rem', marginBottom: '16px', color: 'var(--ink)' }}>Ethical Guidelines</h2>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.7 }}>
            Keep minimum 10 meters from wildlife. Never bait, play recordings of calls, or block animal movement paths to get a shot. In Corcovado and Tortuguero, experienced local guides know how to position groups without causing stress. Respect habitat closures and stay on marked trails. The goal is a photograph that captures natural behavior, not a staged encounter.
          </p>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: 'calc(var(--gutter) * 2)', padding: '28px', background: 'rgba(0,0,0,0.03)', borderRadius: '16px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.3rem', marginBottom: '20px', color: 'var(--ink)' }}>Frequently Asked Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: 'var(--ink)' }}>What are the best locations for jaguar photography in Costa Rica?</h3>
              <p style={{ color: 'var(--ink-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                The Osa Peninsula — especially the Corcovado National Park area — holds the highest jaguar density in the country. Photographs from a vehicle on the Sirena station road offer the best combination of accessibility and natural behavior. Hire a local guide; jaguars are tracked through recent prints and sightings rather than seen reliably.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: 'var(--ink)' }}>Can I photograph wildlife without expensive telephoto lenses?</h3>
              <p style={{ color: 'var(--ink-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                Yes. In Tortuguero, Manuel Antonio, and Monteverde, guides position you within 5–10 meters of sloths, monkeys, and coatimundi using boardwalks and observation platforms. A 70–200mm or 100–400mm works well in these conditions. Avoid locations requiring long-distance shots if you only have a standard zoom.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: 'var(--ink)' }}>Is it safe to do wildlife photography at night in Costa Rica?</h3>
              <p style={{ color: 'var(--ink-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                With an experienced guide, night walks in Monteverde, Puerto Viejo de Talamanca, and the Osa Peninsula are safe and productive. Carry a headlamp with a red filter to preserve your night vision without disturbing nocturnal animals. Never walk alone at night without a guide.
              </p>
            </div>
          </div>
        </section>

        {/* Related links */}
        <section style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.3rem', marginBottom: '16px', color: 'var(--ink)' }}>Explore Related Galleries</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {galleries.map(g => (
              <Link
                key={g.slug}
                href={`/gallery/${g.slug}`}
                style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '999px', border: '1px solid rgba(0,0,0,0.15)', textDecoration: 'none', fontSize: '13px', color: 'var(--ink)', background: 'white', transition: 'all 0.2s' }}
              >
                {g.name}
              </Link>
            ))}
            <Link
              href="/map"
              style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '999px', border: '1px solid rgba(0,0,0,0.15)', textDecoration: 'none', fontSize: '13px', color: 'var(--accent)', background: 'white' }}
            >
              View Photo Map →
            </Link>
          </div>
        </section>

        {locations.length > 0 && (
          <section style={{ marginBottom: 'calc(var(--gutter) * 2)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.3rem', marginBottom: '16px', color: 'var(--ink)' }}>Best Wildlife Photography Locations</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {locations.map(l => (
                <Link
                  key={l.slug}
                  href={`/location/${l.slug}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'white', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.07)', textDecoration: 'none', color: 'var(--ink)' }}
                >
                  <span style={{ fontSize: '16px' }}>📍</span>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{l.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--accent)' }}>→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </>
  );
}