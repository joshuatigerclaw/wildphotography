import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { neon } from '@neondatabase/serverless';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_PUBLIC = 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev';
const SITE_URL = 'https://www.wildphotography.com';

const sql = neon(DATABASE_URL);

function withR2(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

async function getThumbUrl(photoId: number): Promise<string | null> {
  const result = await sql`SELECT thumb_url FROM photos WHERE id = ${photoId}`;
  return result[0]?.thumb_url ? withR2(result[0].thumb_url) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await sql`SELECT * FROM species WHERE slug = ${slug}`;
  const species = result[0];
  if (!species) return { title: 'Species Not Found' };

  const canonical = species.canonical_url || `${SITE_URL}/species/${slug}`;
  const ogImage = species.featured_photo_id
    ? await getThumbUrl(species.featured_photo_id)
    : null;

  return {
    title: species.meta_title || `${species.common_name} in Costa Rica: Photos, Habitat, and Best Places to See It | WildPhotography`,
    description: species.meta_description || `Browse ${species.photo_count} photos of ${species.common_name} in Costa Rica.`,
    alternates: { canonical },
    openGraph: {
      title: species.meta_title || `${species.common_name} | WildPhotography`,
      description: species.meta_description || '',
      url: canonical,
      siteName: 'WildPhotography',
      type: 'website',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : [],
    },
  };
}

export default async function SpeciesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await sql`SELECT * FROM species WHERE slug = ${slug}`;
  const species = result[0];
  if (!species) notFound();

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
  const photos = photosResult.map((row: any) => ({
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

  // Locations for this species via page_links
  const locationsResult = await sql`
    SELECT l.*, pl.weight
    FROM locations l
    JOIN page_links pl ON pl.target_id = l.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'location'
    ORDER BY pl.weight DESC NULLS LAST
    LIMIT 10
  `;
  const locations = locationsResult as any[];

  // Galleries featuring this species via page_links
  const galleriesResult = await sql`
    SELECT g.*
    FROM galleries g
    JOIN page_links pl ON pl.target_id = g.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'gallery'
    ORDER BY pl.weight DESC NULLS LAST
    LIMIT 6
  `;
  const galleries = galleriesResult as any[];

  // Related species via page_links
  const relatedResult = await sql`
    SELECT s.*
    FROM species s
    JOIN page_links pl ON pl.target_id = s.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'species'
    LIMIT 6
  `;
  const relatedSpecies = relatedResult as any[];

  // Travel guides / articles via page_links
  const articlesResult = await sql`
    SELECT a.*
    FROM content_articles a
    JOIN page_links pl ON pl.target_id = a.id
    WHERE pl.source_type = 'species' AND pl.source_id = ${species.id} AND pl.target_type = 'article'
      AND a.status = 'published'
    LIMIT 3
  `;
  const articles = articlesResult as any[];

  return (
    <div className="container" style={{paddingTop:'var(--gutter)',paddingBottom:'calc(var(--gutter) * 2)'}}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{marginBottom:'var(--gutter)'}}>
        <ol style={{display:'flex',alignItems:'center',gap:'10px',listStyle:'none',margin:0,padding:0,fontSize:'13px',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)'}}>
          <li><Link href="/" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Home</Link></li>
          <li>/</li>
          <li><Link href="/species" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Species</Link></li>
          <li>/</li>
          <li style={{color:'var(--ink-muted)'}} aria-current="page">{species.common_name}</li>
        </ol>
      </nav>

      {/* Header */}
      <header style={{marginBottom:'var(--gutter)',paddingBottom:'var(--gutter)',borderBottom:'1px solid var(--rule)'}}>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'clamp(2rem,5vw,3rem)',fontWeight:500,color:'var(--ink)',lineHeight:1.1,margin:'0 0 10px 0'}}>
          {species.common_name} in Costa Rica
        </h1>
        {species.scientific_name && (
          <p style={{fontFamily:'var(--font-serif)',fontStyle:'italic',fontSize:'1.25rem',color:'var(--ink-muted)',margin:'0 0 14px 0'}}>{species.scientific_name}</p>
        )}
        {species.ai_intro ? (
          <p style={{color:'var(--ink-muted)',fontSize:'17px',maxWidth:'680px',lineHeight:1.6,margin:0}}>{species.ai_intro}</p>
        ) : (
          <p style={{color:'var(--ink-dim)',fontFamily:'var(--font-mono)',fontSize:'13px',textTransform:'uppercase',letterSpacing:'.1em',margin:0}}>{species.photo_count} photographs available</p>
        )}
      </header>

      {/* Quick Facts Panel */}
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
          <p style={{color:'var(--ink)',margin:0,fontSize:'14px'}}>{species.photo_count}</p>
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
                style={{display:'block',padding:'18px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none',transition:'border-color var(--t-fast)'}}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--rule)'; }}
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
                style={{display:'block',padding:'18px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none',transition:'border-color var(--t-fast)'}}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--rule)'; }}
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
                style={{display:'inline-flex',alignItems:'center',padding:'8px 16px',border:'1px solid var(--rule)',borderRadius:'var(--r-sm)',fontFamily:'var(--font-serif)',fontSize:'14px',color:'var(--ink-muted)',textDecoration:'none',transition:'border-color var(--t-fast), color var(--t-fast)'}}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--rule)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-muted)'; }}
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
                style={{display:'block',padding:'18px',border:'1px solid var(--rule)',borderRadius:'var(--r-md)',textDecoration:'none',transition:'border-color var(--t-fast)'}}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--rule)'; }}
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
            style={{display:'inline-block',fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--bg)',background:'var(--accent)',padding:'12px 20px',borderRadius:'var(--r-sm)',textDecoration:'none',transition:'background var(--t-fast)'}}
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
  );
}
