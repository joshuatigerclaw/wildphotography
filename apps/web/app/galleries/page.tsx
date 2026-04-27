import Link from 'next/link';
import { Metadata } from 'next';
import { getGalleries } from '@/lib/db';
import { canonicalUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Photo Galleries | Wildphotography',
  description: 'Browse our collection of nature and wildlife photography from Costa Rica. Explore wildlife, landscapes, birds, and more.',
  alternates: {
    canonical: canonicalUrl('/galleries'),
  },
  openGraph: {
    title: 'Photo Galleries | Wildphotography',
    description: 'Browse our collection of nature and wildlife photography from Costa Rica.',
    url: `${SITE_URL}/galleries`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

export default async function GalleriesPage() {
  const galleries = await getGalleries();

  // Sort galleries by photo count
  const sortedGalleries = [...galleries].sort((a, b) => b.photoCount - a.photoCount);

  return (
    <div className="container" style={{paddingTop:'var(--gutter)',paddingBottom:'calc(var(--gutter) * 2)'}}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{marginBottom:'var(--gutter)'}}>
        <ol style={{display:'flex',alignItems:'center',gap:'10px',listStyle:'none',margin:0,padding:0,fontSize:'13px',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)'}}>
          <li><Link href="/" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Home</Link></li>
          <li>/</li>
          <li style={{color:'var(--ink-muted)'}} aria-current="page">Galleries</li>
        </ol>
      </nav>

      <header style={{marginBottom:'var(--gutter)',paddingBottom:'var(--gutter)',borderBottom:'1px solid var(--rule)'}}>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'clamp(2rem,5vw,3rem)',fontWeight:500,color:'var(--ink)',lineHeight:1.1,margin:'0 0 14px 0'}}>
          Photo Galleries
        </h1>
        <p style={{color:'var(--ink-muted)',fontSize:'17px',maxWidth:'560px',margin:0,lineHeight:1.55}}>
          {galleries.length} gallery collections — wildlife, landscapes, birds, and more from Costa Rica.
        </p>
      </header>

      {sortedGalleries.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0',color:'var(--ink-dim)',fontFamily:'var(--font-serif)'}}>
          <p>No galleries available yet.</p>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'20px'}}>
          {sortedGalleries.map((gallery) => (
            <Link
              key={gallery.id}
              href={`/gallery/${gallery.slug}`}
              style={{display:'block',textDecoration:'none'}}
            >
              <div style={{aspectRatio:'1/1',background:'var(--bg-inset)',borderRadius:'var(--r-md)',overflow:'hidden',marginBottom:'12px',border:'1px solid var(--rule)'}}>
                {gallery.coverPhotoUrl ? (
                  <img
                    src={gallery.coverPhotoUrl}
                    alt={gallery.name}
                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block',transition:'transform var(--t-med)'}}
                    loading="lazy"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                  />
                ) : (
                  <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ink-dim)',fontSize:'32px'}}>📷</div>
                )}
              </div>
              <h3 style={{fontFamily:'var(--font-display)',fontSize:'15px',fontWeight:500,color:'var(--ink)',margin:'0 0 4px 0',transition:'color var(--t-fast)'}}>
                {gallery.name}
              </h3>
              <p style={{fontFamily:'var(--font-mono)',fontSize:'11px',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)',margin:0}}>
                {gallery.photoCount} PHOTO{gallery.photoCount !== 1 ? 'S' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
