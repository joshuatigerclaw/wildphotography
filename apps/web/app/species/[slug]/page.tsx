import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { generateBreadcrumbJsonLd, canonicalUrl } from '@/lib/seo';
import { sql } from '@/lib/db';
import { speciesIndexable } from '@/lib/seo-config';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const R2_PUBLIC = 'https://images.wildphotography.com';
const SITE_URL = 'https://wildphotography.com';

function withR2(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  // Join with photos to get featured image in one query
  const result = await sql`
    SELECT s.*,
           p.thumb_url as "featured_thumb_url"
    FROM species s
    LEFT JOIN photos p ON p.id = s.featured_photo_id
    WHERE s.slug = ${slug}
  `;
  const species = result[0] as any;
  if (!species) return { title: 'Species Not Found' };

  const canonical = canonicalUrl(`/species/${slug}`);
  const ogImage = species.featured_thumb_url ? withR2(species.featured_thumb_url) : null;

  // Determine if this page should be indexed
  const indexable = speciesIndexable(
    species.photo_count || 0,
    !!(species.ai_intro || species.meta_description)
  );

  // Build H1
  const h1 = species.common_name
    ? `${species.common_name} in Costa Rica`
    : `Species in Costa Rica`;

  // Build SEO title
  const baseTitle = species.meta_title
    || `${species.common_name} in Costa Rica: Photos, Habitat & Best Places to See It`;

  return {
    title: `${baseTitle} | WildPhotography`,
    description: species.meta_description || `Browse ${species.photo_count || 0} photos of ${species.common_name} in Costa Rica.`,
    alternates: { canonical },
    robots: indexable.indexable ? undefined : { index: false, follow: true },
    openGraph: {
      title: species.meta_title || `${species.common_name} | WildPhotography`,
      description: species.meta_description || '',
      url: canonical,
      siteName: 'WildPhotography',
      type: 'website',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: species.common_name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: species.meta_title || `${species.common_name} | WildPhotography`,
      description: species.meta_description || undefined,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function SpeciesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Join with featured photo for OG image
  const result = await sql`
    SELECT s.*,
           p.thumb_url as "featured_thumb_url"
    FROM species s
    LEFT JOIN photos p ON p.id = s.featured_photo_id
    WHERE s.slug = ${slug}
  `;
  const species = result[0] as any;
  if (!species) notFound();

  const indexable = speciesIndexable(
    species.photo_count || 0,
    !!(species.ai_intro || species.meta_description)
  );

  // Photos for this species via photo_species junction
  const photosResult = await sql`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location,
           p.region, p.country, p.species_common_name, p.species_scientific_name
    FROM photos p
    JOIN photo_species ps ON ps.photo_id = p.id
    WHERE ps.species_id = ${species.id}
      AND p.search_ready = true
      AND p.is_active = true
    ORDER BY p.popularity DESC NULLS LAST
    LIMIT 24
  `;
  const photos = (photosResult as any[]).map((row: any) => ({
    id: String(row.id),
    slug: row.slug,
    title: row.title || '',
    thumbUrl: withR2(row.thumb_url),
    smallUrl: withR2(row.small_url),
    mediumUrl: withR2(row.medium_url),
    largeUrl: withR2(row.large_url),
    locationName: row.location,
    region: row.region || null,
    species_common_name: row.species_common_name || null,
  }));

  // Locations for this species via page_links
  const locationsResult = await sql`
    SELECT l.id, l.name, l.slug, l.region, l.ai_intro
    FROM locations l
    JOIN page_links pl ON pl.target_id = l.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'location'
    ORDER BY pl.weight DESC NULLS LAST
    LIMIT 10
  `;
  const locations = locationsResult as any[];

  // Galleries featuring this species via page_links
  const galleriesResult = await sql`
    SELECT g.id, g.name, g.slug, g.description
    FROM galleries g
    JOIN page_links pl ON pl.target_id = g.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'gallery'
    ORDER BY pl.weight DESC NULLS LAST
    LIMIT 6
  `;
  const galleries = galleriesResult as any[];

  // Related species via page_links
  const relatedResult = await sql`
    SELECT s.id, s.common_name, s.slug, s.scientific_name
    FROM species s
    JOIN page_links pl ON pl.target_id = s.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'species'
    LIMIT 6
  `;
  const relatedSpecies = relatedResult as any[];

  // Travel guides / articles via page_links
  const articlesResult = await sql`
    SELECT a.id, a.slug, a.title, a.excerpt
    FROM content_articles a
    JOIN page_links pl ON pl.target_id = a.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'article'
      AND a.status = 'published'
    LIMIT 3
  `;
  const articles = articlesResult as any[];

  // Featured OG image
  const featuredThumb = species.featured_thumb_url ? withR2(species.featured_thumb_url) : null;

  // ── CollectionPage JSON-LD ────────────────────────────────────────
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${species.common_name} in Costa Rica`,
    description: species.meta_description || `Photography collection of ${species.common_name} in Costa Rica.`,
    url: canonicalUrl(`/species/${slug}`),
    image: featuredThumb ? { '@type': 'ImageObject', url: featuredThumb } : undefined,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: species.photo_count || 0,
      itemListElement: photos.slice(0, 10).map((p: any, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/photo/${p.slug}`,
        name: p.title || species.common_name,
      })),
    },
    publisher: { '@type': 'Organization', name: 'WildPhotography', url: SITE_URL },
    author: { '@type': 'Person', name: 'Joshua ten Brink', url: SITE_URL },
  };

  // ── BreadcrumbList JSON-LD ────────────────────────────────────────
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/' },
    { name: 'Species', url: '/species' },
    { name: species.common_name || 'Species', url: `/species/${species.slug}` },
  ]);

  const h1 = species.common_name
    ? `${species.common_name} in Costa Rica`
    : 'Species in Costa Rica';

  return (
    <>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* noindex banner for thin pages */}
      {!indexable.indexable && (
        <meta name="robots" content="noindex, follow" />
      )}

      <div style={{paddingTop:'var(--gutter)',paddingBottom:'calc(var(--gutter) * 2)'}}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{marginBottom:'var(--gutter)',maxWidth:'1100px',margin:'0 auto',padding:'0 20px'}}>
          <ol style={{display:'flex',alignItems:'center',gap:'10px',listStyle:'none',margin:0,padding:0,fontSize:'13px',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)',flexWrap:'wrap'}}>
            <li><Link href="/" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Home</Link></li>
            <li>/</li>
            <li><Link href="/species" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Species</Link></li>
            <li>/</li>
            <li style={{color:'var(--ink-muted)'}} aria-current="page">{species.common_name}</li>
          </ol>
        </nav>

        <div style={{maxWidth:'1100px',margin:'0 auto',padding:'0 20px'}}>
          {/* Thin page warning */}
          {!indexable.indexable && (
            <div style={{marginBottom:'var(--gutter)',padding:'12px 16px',background:'var(--bg-inset)',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',fontSize:'13px',color:'var(--ink-dim)'}}>
              This page has limited content ({species.photo_count || 0} photos). More photography coming soon.
            </div>
          )}

          {/* Header */}
          <header style={{marginBottom:'var(--gutter)',paddingBottom:'var(--gutter)',borderBottom:'1px solid var(--rule)'}}>
            <h1 style={{fontFamily:'var(--font-display)',fontSize:'clamp(2rem,5vw,3rem)',fontWeight:500,color:'var(--ink)',lineHeight:1.1,margin:'0 0 10px 0'}}>
              {h1}
            </h1>
            {species.scientific_name && (
              <p style={{fontFamily:'var(--font-serif)',fontStyle:'italic',fontSize:'1.25rem',color:'var(--ink-muted)',margin:'0 0 14px 0'}}>{species.scientific_name}</p>
            )}
            {species.ai_intro ? (
              <p style={{color:'var(--ink-muted)',fontSize:'17px',maxWidth:'680px',lineHeight:1.6,margin:0}}>{species.ai_intro}</p>
            ) : (
              <p style={{color:'var(--ink-dim)',fontFamily:'var(--font-mono)',fontSize:'13px',textTransform:'uppercase',letterSpacing:'.1em',margin:0}}>{species.photo_count || 0} photographs available</p>
            )}
          </header>

          {/* Quick Facts */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'12px',marginBottom:'var(--gutter)',padding:'20px',background:'var(--bg-inset)',borderRadius:'var(--r-md)',border:'1px solid var(--rule)'}}>
            {species.scientific_name && (
              <div>
                <span style={{display:'block',fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--ink-dim)',marginBottom:'4px'}}>Scientific Name</span>
                <p style={{fontFamily:'var(--font-serif)',fontStyle:'italic',color:'var(--ink)',margin:0,fontSize:'14px'}}>{species.scientific_name}</p>
              </div>
            )}
            {species.animal_group && (
              <div>
                <span style={{display:'block',fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--ink-dim)',marginBottom:'4px'}}>Group</span>
                <p style={{color:'var(--ink)',margin:0,fontSize:'14px'}}>{species.animal_group}</p>
              </div>
            )}
            <div>
              <span style={{display:'block',fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--ink-dim)',marginBottom:'4px'}}>Photos</span>
              <p style={{color:'var(--ink)',margin:0,fontSize:'14px'}}>{species.photo_count || 0}</p>
            </div>
            <div>
              <span style={{display:'block',fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--ink-dim)',marginBottom:'4px'}}>Best Locations</span>
              <p style={{color:'var(--ink)',margin:0,fontSize:'14px'}}>{locations.slice(0, 2).map((l: any) => l.name).join(', ') || 'See below'}</p>
            </div>
          </div>

          {/* Featured Photos */}
          {photos.length > 0 && (
            <section style={{marginBottom:'var(--gutter)'}}>
              <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 20px 0'}}>Featured Photos</h2>
              <VirtualizedGallery photos={photos.slice(0, 8)} columns={4} />
            </section>
          )}

          {/* Where to See */}
          {locations.length > 0 && (
            <section style={{marginBottom:'var(--gutter)'}}>
              <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 20px 0'}}>Where to See {species.common_name}</h2>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'12px'}}>
                {locations.slice(0, 6).map((loc: any) => (
                  <Link
                    key={loc.id}
                    href={`/location/${loc.slug}`}
                    style={{display:'block',padding:'18px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none'}}
                  >
                    <h3 style={{fontFamily:'var(--font-display)',fontSize:'15px',fontWeight:500,color:'var(--ink)',margin:'0 0 4px 0'}}>{loc.name}</h3>
                    {loc.region && <p style={{fontFamily:'var(--font-mono)',fontSize:'10px',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)',margin:'0 0 8px 0'}}>{loc.region} region</p>}
                    {loc.ai_intro && <p style={{fontSize:'13px',color:'var(--ink-muted)',margin:0,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{loc.ai_intro}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Galleries */}
          {galleries.length > 0 && (
            <section style={{marginBottom:'var(--gutter)'}}>
              <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 20px 0'}}>Galleries Featuring {species.common_name}</h2>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px'}}>
                {galleries.map((g: any) => (
                  <Link
                    key={g.id}
                    href={`/gallery/${g.slug}`}
                    style={{display:'block',padding:'18px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none'}}
                  >
                    <h3 style={{fontFamily:'var(--font-display)',fontSize:'15px',fontWeight:500,color:'var(--ink)',margin:'0 0 4px 0'}}>{g.name}</h3>
                    {g.description && <p style={{fontSize:'13px',color:'var(--ink-dim)',margin:0,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{g.description}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Related Species */}
          {relatedSpecies.length > 0 && (
            <section style={{marginBottom:'var(--gutter)'}}>
              <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 16px 0'}}>Related Species</h2>
              <div style={{display:'flex',flexWrap:'wrap',gap:'10px'}}>
                {relatedSpecies.map((rs: any) => (
                  <Link
                    key={rs.id}
                    href={`/species/${rs.slug}`}
                    style={{display:'inline-flex',alignItems:'center',padding:'8px 16px',border:'1px solid var(--rule)',borderRadius:'var(--r-sm)',fontFamily:'var(--font-serif)',fontSize:'14px',color:'var(--ink-muted)',textDecoration:'none'}}
                  >
                    {rs.common_name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Travel Guides */}
          {articles.length > 0 && (
            <section style={{marginBottom:'var(--gutter)'}}>
              <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 16px 0'}}>Travel Guides</h2>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {articles.map((art: any) => (
                  <Link
                    key={art.id}
                    href={`/article/${art.slug}`}
                    style={{display:'block',padding:'18px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none'}}
                  >
                    <h3 style={{fontFamily:'var(--font-display)',fontSize:'16px',fontWeight:500,color:'var(--ink)',margin:'0 0 6px 0'}}>{art.title}</h3>
                    {art.excerpt && <p style={{fontSize:'13px',color:'var(--ink-dim)',margin:0,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{art.excerpt}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Tours CTA */}
          {locations.length > 0 && (
            <section style={{marginBottom:'var(--gutter)',padding:'24px',background:'var(--bg-inset)',borderRadius:'var(--r-md)',border:'1px solid var(--rule)'}}>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.25rem',fontWeight:500,color:'var(--ink)',margin:'0 0 8px 0'}}>
                Tours to See {species.common_name}
              </h2>
              <p style={{fontSize:'14px',color:'var(--ink-muted)',margin:'0 0 16px 0'}}>
                Plan your wildlife photography trip to {locations[0]?.name || 'Costa Rica'} with guided tours.
              </p>
              <Link
                href={`/location/${locations[0]?.slug}`}
                style={{display:'inline-block',fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--bg)',background:'var(--accent)',padding:'12px 20px',borderRadius:'var(--r-sm)',textDecoration:'none'}}
              >
                Find Tours Near {locations[0]?.name || 'This Area'}
              </Link>
            </section>
          )}

          {/* All Photos */}
          {photos.length > 8 && (
            <section>
              <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 20px 0'}}>All {species.common_name} Photos ({photos.length})</h2>
              <VirtualizedGallery photos={photos} columns={4} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
