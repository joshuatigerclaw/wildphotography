import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql, getGalleryBySlug } from '@/lib/db';
import { generateBreadcrumbJsonLd, canonicalUrl } from '@/lib/seo';
import GalleryClient from './GalleryClient';

// ISR — revalidate every 60s instead of hitting Neon on every request
export const revalidate = 60;

const R2_PUBLIC = 'https://images.wildphotography.com';
const SITE_URL = 'https://wildphotography.com';

function withR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

async function getPhotosByGallery(
  gallerySlug: string,
  limit = 100,
  offset = 0
) {
  const GALLERY_PHOTO_ORDER = 'gp.sort_order ASC NULLS LAST, p.date_uploaded ASC NULLS LAST, p.id ASC';

  const countResult = await sql`
    SELECT COUNT(*) as count
    FROM gallery_photos gp
    JOIN galleries g ON gp.gallery_id = g.id
    JOIN photos p ON gp.photo_id = p.id
    WHERE g.slug = ${gallerySlug} AND p.is_active = true AND p.ready_for_public_render = true
  `;
  const total = Number(countResult[0]?.count || 0);

  const result = await sql`
    SELECT p.id, p.slug, p.title, p.description, p.description_long, p.keywords,
           p.width, p.height, p.camera_make, p.camera_model, p.lens,
           p.iso, p.aperture, p.shutter_speed, p.focal_length_mm,
           p.lat, p.lon, p.views_count, p.date_taken, p.date_uploaded,
           p.thumb_url, p.small_url, p.medium_url, p.large_url, p.location,
           p.region, p.country, p.species_common_name, p.species_scientific_name
    FROM photos p
    JOIN gallery_photos gp ON p.id = gp.photo_id
    JOIN galleries g ON gp.gallery_id = g.id
    WHERE g.slug = ${gallerySlug} AND p.is_active = true AND p.ready_for_public_render = true
    ORDER BY gp.sort_order ASC NULLS LAST, p.date_uploaded ASC NULLS LAST, p.id ASC
    LIMIT ${limit + 1} OFFSET ${offset}
  `;

  const hasMore = result.length > limit;
  const photos = result.slice(0, limit).map((row: any) => ({
    id: String(row.id),
    slug: row.slug,
    title: row.title || '',
    description: row.description,
    description_long: row.description_long,
    keywords: row.keywords,
    width: row.width,
    height: row.height,
    camera_make: row.camera_make,
    camera_model: row.camera_model,
    lens: row.lens,
    iso: row.iso,
    aperture: row.aperture,
    shutter_speed: row.shutter_speed,
    focal_length_mm: row.focal_length_mm,
    lat: row.lat,
    lon: row.lon,
    views_count: row.views_count,
    date_taken: row.date_taken,
    date_uploaded: row.date_uploaded,
    thumbUrl: withR2(row.thumb_url),
    smallUrl: withR2(row.small_url),
    mediumUrl: withR2(row.medium_url),
    largeUrl: withR2(row.large_url),
    locationName: row.location,
    region: row.region || null,
    country: row.country || null,
    species_common_name: row.species_common_name || null,
    species_scientific_name: row.species_scientific_name || null,
  }));

  return { photos, total, hasMore };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await getGalleryBySlug(slug);

  if (!gallery) return { title: 'Gallery Not Found' };

  const canonical = `${SITE_URL}/gallery/${gallery.slug}`;
  const ogImage = gallery.coverPhotoUrl;
  const desc = gallery.description || `${gallery.name} - ${gallery.photoCount} beautiful nature photography images from Costa Rica`;

  return {
    title: `${gallery.name} | WildPhotography`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: `${gallery.name} | WildPhotography`,
      description: gallery.description || `${gallery.name} - ${gallery.photoCount} photos from Costa Rica`,
      url: canonical,
      siteName: 'WildPhotography',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: gallery.name }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${gallery.name} | WildPhotography`,
      description: gallery.description || undefined,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = await getGalleryBySlug(slug);

  if (!gallery) notFound();

  const { photos, total } = await getPhotosByGallery(slug, 100, 0);

  // Species featured in this gallery's photos (via photo_species junction)
  const speciesResult = await sql`
    SELECT s.id, s.common_name, s.scientific_name, s.slug, s.photo_count,
           COUNT(ps.photo_id) as photo_in_gallery
    FROM species s
    JOIN photo_species ps ON ps.species_id = s.id
    JOIN gallery_photos gp ON gp.photo_id = ps.photo_id
    JOIN galleries g ON g.id = gp.gallery_id
    WHERE g.slug = ${slug}
    GROUP BY s.id, s.common_name, s.scientific_name, s.slug, s.photo_count
    ORDER BY photo_in_gallery DESC, s.common_name
    LIMIT 6
  `;
  const species = speciesResult as any[];

  // Locations covered by this gallery's photos (via photo_locations)
  const locationsResult = await sql`
    SELECT l.id, l.name, l.slug, l.region,
           COUNT(DISTINCT gp.photo_id) as photo_count
    FROM locations l
    JOIN photo_locations ploc ON ploc.location_id = l.id
    JOIN gallery_photos gp ON gp.photo_id = ploc.photo_id
    JOIN galleries g ON g.id = gp.gallery_id
    WHERE g.slug = ${slug}
    GROUP BY l.id, l.name, l.slug, l.region
    ORDER BY photo_count DESC, l.name
    LIMIT 6
  `;
  const locations = locationsResult as any[];

  // Fallback: locations from photo.location field
  const locationFallback = await sql`
    SELECT DISTINCT p.location as name, l.slug,
           COUNT(*) as photo_count
    FROM photos p
    JOIN gallery_photos gp ON gp.photo_id = p.id
    JOIN galleries g ON g.id = gp.gallery_id
    LEFT JOIN locations l ON l.name = p.location
    WHERE g.slug = ${slug}
      AND p.location IS NOT NULL AND p.location != ''
    GROUP BY p.location, l.slug
    ORDER BY COUNT(*) DESC
    LIMIT 6
  `;
  const photoLocations = locationFallback as any[];

  // Related galleries: galleries sharing species with this gallery
  const relatedResult = await sql`
    SELECT DISTINCT g2.id, g2.name, g2.slug, g2.description
    FROM galleries g1
    JOIN gallery_photos gp1 ON gp1.gallery_id = g1.id
    JOIN photo_species ps1 ON ps1.photo_id = gp1.photo_id
    JOIN gallery_photos gp2 ON gp2.photo_id = ps1.photo_id
    JOIN galleries g2 ON g2.id = gp2.gallery_id
    WHERE g1.slug = ${slug} AND g2.slug != ${slug} AND g2.is_active = true
    ORDER BY g2.name
    LIMIT 6
  `;
  const relatedGalleries = relatedResult as any[];

  // ── JSON-LD: Gallery Page schema ─────────────────────────────────
  const galleryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: gallery.name,
    description: gallery.description || undefined,
    url: `${SITE_URL}/gallery/${gallery.slug}`,
    image: gallery.coverPhotoUrl ? { '@type': 'ImageObject', url: gallery.coverPhotoUrl } : undefined,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: photos.slice(0, 20).map((p: any, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/photo/${p.slug}`,
        name: p.title || p.species_common_name || 'Photo',
      })),
    },
    publisher: {
      '@type': 'Organization',
      name: 'WildPhotography',
      url: SITE_URL,
    },
    author: {
      '@type': 'Person',
      name: 'Joshua ten Brink',
      url: SITE_URL,
    },
  };

  // ── BreadcrumbList JSON-LD ───────────────────────────────────────
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/' },
    { name: 'Galleries', url: '/galleries' },
    { name: gallery.name, url: `/gallery/${gallery.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(galleryJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="container" style={{paddingTop: 'var(--gutter)', paddingBottom: 'calc(var(--gutter) * 2)'}}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{marginBottom: 'var(--gutter)'}}>
        <ol style={{display:'flex',alignItems:'center',gap:'10px',listStyle:'none',margin:0,padding:0,fontSize:'13px',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)'}}>
          <li><Link href="/" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Home</Link></li>
          <li>/</li>
          <li><Link href="/galleries" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Galleries</Link></li>
          <li>/</li>
          <li style={{color:'var(--ink-muted)'}} aria-current="page">{gallery.name}</li>
        </ol>
      </nav>

      {/* Gallery header */}
      <header style={{marginBottom:'calc(var(--gutter) * 1.5)',paddingBottom:'var(--gutter)',borderBottom:'1px solid var(--rule)'}}>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'clamp(2rem,5vw,3.5rem)',fontWeight:500,color:'var(--ink)',lineHeight:1.1,margin:'0 0 16px 0'}}>
          {gallery.name}
        </h1>
        {gallery.description && (
          <p style={{color:'var(--ink-muted)',fontSize:'18px',maxWidth:'640px',margin:'0 0 16px 0',lineHeight:1.6}}>
            {gallery.description}
          </p>
        )}
        <div style={{display:'flex',alignItems:'center',gap:'12px',fontSize:'13px',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)'}}>
          <span>
            {total > 0 ? `${total.toLocaleString()} PHOTO${total !== 1 ? 'S' : ''}` : 'No photos'}
          </span>
          {gallery.photoCount > 0 && (
            <>
              <span style={{color:'var(--rule)'}}>·</span>
              <span>Costa Rica</span>
            </>
          )}
        </div>
      </header>

      {/* ── Birds gallery editorial introduction ── */}
      {gallery.slug === 'birds' && (
        <section style={{marginBottom:'var(--gutter)',padding:'24px',background:'var(--bg-inset)',borderRadius:'var(--r-md)',border:'1px solid var(--rule)'}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',fontWeight:500,color:'var(--ink)',margin:'0 0 16px 0'}}>
            Costa Rica Bird Photography
          </h2>
          <div style={{color:'var(--ink-muted)',fontSize:'15px',lineHeight:1.7,maxWidth:'680px'}}>
            <p style={{margin:'0 0 14px 0'}}>
              With more than 900 bird species recorded within its borders, Costa Rica consistently ranks among the best birdwatching destinations on the planet. That diversity across an area smaller than West Virginia — spanning volcanic highlands, Pacific coastline, Caribbean lowlands, and cloud forests — is what drew me here fifteen years ago, and it's what keeps me finding new subjects to photograph.
            </p>
            <p style={{margin:'0 0 14px 0'}}>
              This gallery represents years of field work across the country: tracking Scarlet Macaw pairs along the Pacific coast at dawn, waiting for the Resplendent Quetzal to appear in the Monteverde mist, and photographing the iridescent hummingbirds that crowd the highland feeders year-round. Each image in this collection comes from actual field sessions — no captive specimens, no staged setups.
            </p>
            <p style={{margin:'0 0 14px 0'}}>
              The gallery spans a range of families: toucans and aracaris in the lowland rainforests, waders and shorebirds along both coasts, hawks and raptors soaring over mountain ridges, and the dozens of hummingbird species that make Costa Rica a hummer destination rivaling Ecuador and Peru. I have particular depth in Scarlet Macaw photography from the Nicoya Peninsula and in the waterbird populations of the Guanacaste wetlands.
            </p>
            <p style={{margin:'0 0 14px 0'}}>
              The sub-galleries below represent some of the strongest concentrations of images — macaws, toucans, hummingbirds, motmots, and wading birds each have their own dedicated collections. Browse by species if you are looking for something specific, or explore by location if your trip is focused on a particular region.
            </p>
            <p style={{margin:0}}>
              Every photograph in this collection is available as a museum-quality print or for licensing. If you are planning a birding trip to Costa Rica and want photography guidance for specific locations or species, the individual species pages include notes on where and when to find each bird.
            </p>
          </div>
          {/* Sub-gallery quick links */}
          <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginTop:'20px'}}>
            {[
              { slug: 'birds-macaws-lapas', label: 'Scarlet Macaws' },
              { slug: 'birds-toucans', label: 'Toucans' },
              { slug: 'birds-hummingbirds', label: 'Hummingbirds' },
              { slug: 'birds-motmots', label: 'Motmots' },
              { slug: 'birds-waders', label: 'Wading Birds' },
            ].map(g => (
              <Link key={g.slug} href={`/gallery/${g.slug}`}
                style={{display:'inline-flex',alignItems:'center',padding:'7px 14px',border:'1px solid var(--rule)',borderRadius:'var(--r-sm)',fontFamily:'var(--font-mono)',fontSize:'11px',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-muted)',textDecoration:'none'}}>
                {g.label} &rarr;
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Species in this gallery */}
      {species.length > 0 && (
        <section style={{marginBottom:'var(--gutter)'}}>
          <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 20px 0'}}>Species in this Gallery</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'10px'}}>
            {species.map((s: any) => (
              <Link
                key={s.id}
                href={`/species/${s.slug}`}
                className="gallery-species-link"
                style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'8px 16px',border:'1px solid var(--rule)',borderRadius:'var(--r-sm)',fontFamily:'var(--font-serif)',fontSize:'14px',color:'var(--ink-muted)',textDecoration:'none'}}
              >
                {s.common_name}
                {s.scientific_name && (
                  <span style={{fontFamily:'var(--font-serif)',fontStyle:'italic',fontSize:'12px',color:'var(--ink-dim)'}}>{s.scientific_name}</span>
                )}
                <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',color:'var(--ink-dim)'}}>({s.photo_in_gallery})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Locations covered */}
      {(locations.length > 0 || photoLocations.length > 0) && (
        <section style={{marginBottom:'var(--gutter)'}}>
          <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 20px 0'}}>Locations Covered</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px'}}>
            {locations.length > 0
              ? locations.map((loc: any) => (
                  <Link
                    key={loc.id}
                    href={`/location/${loc.slug}`}
                    className="gallery-location-link"
                    style={{display:'block',padding:'16px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none'}}
                  >
                    <span style={{fontFamily:'var(--font-display)',fontSize:'15px',fontWeight:500,color:'var(--ink)'}}>{loc.name}</span>
                    {loc.region && <span style={{display:'block',fontFamily:'var(--font-mono)',fontSize:'10px',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)',marginTop:'4px'}}>{loc.region}</span>}
                  </Link>
                ))
              : photoLocations.map((loc: any, i: number) => (
                  <div key={i} style={{padding:'16px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)'}}>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'15px',fontWeight:500,color:'var(--ink)'}}>{loc.name}</span>
                    <span style={{display:'block',fontFamily:'var(--font-mono)',fontSize:'10px',color:'var(--ink-dim)',marginTop:'4px'}}>{loc.photo_count} photos</span>
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Related galleries */}
      {relatedGalleries.length > 0 && (
        <section style={{marginBottom:'var(--gutter)'}}>
          <h2 style={{fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--accent)',margin:'0 0 20px 0'}}>Related Galleries</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'12px'}}>
            {relatedGalleries.map((g: any) => (
              <Link
                key={g.id}
                href={`/gallery/${g.slug}`}
                className="gallery-related-link"
                style={{display:'block',padding:'20px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none'}}
              >
                <h3 style={{fontFamily:'var(--font-display)',fontSize:'16px',fontWeight:500,color:'var(--ink)',margin:'0 0 6px 0'}}>{g.name}</h3>
                {g.description && (
                  <p style={{fontSize:'13px',color:'var(--ink-dim)',margin:0,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{g.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Affiliate CTA */}
      <section style={{marginBottom:'var(--gutter)',padding:'20px 24px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',background:'var(--bg-raised)'}}>
        <p style={{fontFamily:'var(--font-display)',fontSize:'16px',fontWeight:500,color:'var(--ink)',margin:'0 0 6px 0'}}>
          {gallery.name
            ? `Explore tours near ${gallery.name}`
            : 'Explore Costa Rica nature tours'}
        </p>
        <p style={{fontSize:'13px',color:'var(--ink-dim)',margin:'0 0 14px 0'}}>
          Find guided wildlife, birdwatching, and photography experiences in Costa Rica.
        </p>
        <a
          href={`https://www.getyourguide.com/s/?q=${encodeURIComponent((gallery.name || 'Costa Rica') + ' nature tours')}&partner_id=WILD`}
          target="_blank"
          rel="noopener sponsored"
          style={{display:'inline-block',fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--bg)',background:'var(--accent)',padding:'10px 18px',borderRadius:'var(--r-sm)',textDecoration:'none',transition:'background var(--t-fast)'}}
        >
          Browse experiences
        </a>
      </section>

      {/* Photo grid + lightbox */}
      {total > 0 ? (
        <GalleryClient
          photos={photos}
          gallerySlug={gallery.slug}
          galleryName={gallery.name}
        />
      ) : (
        <div style={{textAlign:'center',padding:'80px 0',color:'var(--ink-dim)',fontFamily:'var(--font-serif)'}}>
          <p style={{margin:'0 0 12px 0'}}>No photos in this gallery yet.</p>
          <Link href="/galleries" style={{color:'var(--accent)',textDecoration:'none',fontFamily:'var(--font-mono)',fontSize:'13px',textTransform:'uppercase',letterSpacing:'.1em'}}>
            Browse other galleries &rarr;
          </Link>
        </div>
      )}
    </div>
    </>
  );
}
