import Link from 'next/link';
import { Metadata } from 'next';
import { getAllSpecies } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'Bird & Wildlife Species | Wildphotography',
  description: 'Browse our collection of bird and wildlife species photographed in Costa Rica. From hummingbirds to macaws, toucans to quetzals.',
  alternates: {
    canonical: `${SITE_URL}/species`,
  },
  openGraph: {
    title: 'Bird & Wildlife Species | Wildphotography',
    description: 'Browse our collection of bird and wildlife species photographed in Costa Rica.',
    url: `${SITE_URL}/species`,
    siteName: 'Wildphotography',
    type: 'website',
  },
};

export default async function SpeciesPage() {
  const species = await getAllSpecies();
  
  // Group species by first letter for easier navigation
  const grouped = species.reduce((acc, s) => {
    const letter = s.name.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(s);
    return acc;
  }, {} as Record<string, typeof species>);
  
  const letters = Object.keys(grouped).sort();

  return (
    <div className="container" style={{paddingTop:'var(--gutter)',paddingBottom:'calc(var(--gutter) * 2)'}}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{marginBottom:'var(--gutter)'}}>
        <ol style={{display:'flex',alignItems:'center',gap:'10px',listStyle:'none',margin:0,padding:0,fontSize:'13px',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)'}}>
          <li><Link href="/" style={{color:'var(--ink-dim)',textDecoration:'none'}}>Home</Link></li>
          <li>/</li>
          <li style={{color:'var(--ink-muted)'}} aria-current="page">Species</li>
        </ol>
      </nav>

      <header style={{marginBottom:'var(--gutter)',paddingBottom:'var(--gutter)',borderBottom:'1px solid var(--rule)'}}>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'clamp(2rem,5vw,3rem)',fontWeight:500,color:'var(--ink)',lineHeight:1.1,margin:'0 0 14px 0'}}>
          Bird &amp; Wildlife Species
        </h1>
        <p style={{color:'var(--ink-muted)',fontSize:'17px',maxWidth:'560px',margin:0,lineHeight:1.55}}>
          {species.length} species photographed in Costa Rica — from hummingbirds to macaws.
        </p>
      </header>

      {species.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0',color:'var(--ink-dim)',fontFamily:'var(--font-serif)'}}>
          <p>No species data available yet.</p>
        </div>
      ) : (
        <>
          {/* Letter navigation */}
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'var(--gutter)',paddingBottom:'var(--gutter)',borderBottom:'1px solid var(--rule)'}}>
            {letters.map(letter => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                style={{display:'flex',alignItems:'center',justifyContent:'center',width:'34px',height:'34px',borderRadius:'50%',border:'1px solid var(--rule)',fontFamily:'var(--font-mono)',fontSize:'13px',fontWeight:500,color:'var(--ink-muted)',textDecoration:'none',transition:'border-color var(--t-fast), color var(--t-fast)'}}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--rule)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-muted)'; }}
              >
                {letter}
              </a>
            ))}
          </div>

          {/* Species grid by letter */}
          <div style={{display:'flex',flexDirection:'column',gap:'48px'}}>
            {letters.map(letter => (
              <section key={letter} id={`letter-${letter}`}>
                <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.5rem',fontWeight:500,color:'var(--ink)',margin:'0 0 20px 0',display:'flex',alignItems:'center',gap:'14px'}}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'40px',height:'40px',borderRadius:'50%',background:'var(--bg-inset)',border:'1px solid var(--rule)',fontFamily:'var(--font-mono)',fontSize:'14px',color:'var(--accent)'}}>
                    {letter}
                  </span>
                </h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'16px'}}>
                  {grouped[letter].map((s) => (
                    <Link
                      key={`${s.name}-${s.scientificName || 'no-sci'}`}
                      href={`/species/${s.slug}`}
                      style={{display:'block',textDecoration:'none'}}
                    >
                      <div style={{aspectRatio:'1/1',background:'var(--bg-inset)',borderRadius:'var(--r-md)',overflow:'hidden',marginBottom:'10px',border:'1px solid var(--rule)'}}>
                        {s.sampleThumb ? (
                          <img
                            src={s.sampleThumb}
                            alt={s.name}
                            style={{width:'100%',height:'100%',objectFit:'cover',display:'block',transition:'transform var(--t-med)'}}
                            loading="lazy"
                            onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                          />
                        ) : (
                          <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ink-dim)',fontSize:'28px'}}>🦜</div>
                        )}
                      </div>
                      <h3 style={{fontFamily:'var(--font-display)',fontSize:'14px',fontWeight:500,color:'var(--ink)',margin:'0 0 3px 0',transition:'color var(--t-fast)'}}>
                        {s.name}
                      </h3>
                      {s.scientificName && (
                        <p style={{fontFamily:'var(--font-serif)',fontStyle:'italic',fontSize:'12px',color:'var(--ink-dim)',margin:'0 0 3px 0'}}>
                          {s.scientificName}
                        </p>
                      )}
                      <p style={{fontFamily:'var(--font-mono)',fontSize:'10px',textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ink-dim)',margin:0}}>
                        {s.photoCount} PHOTO{s.photoCount !== 1 ? 'S' : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
