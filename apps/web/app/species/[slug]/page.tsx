import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllSpecies, getPhotosBySpecies } from '@/lib/db';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

/**
 * Generate static params for species routes
 */
export async function generateStaticParams() {
  const species = await getAllSpecies();
  return species.map(s => ({
    slug: s.slug,
  }));
}

/**
 * Generate metadata for species page
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const allSpecies = await getAllSpecies();
  const speciesData = allSpecies.find(s => s.slug === slug);
  
  if (!speciesData) {
    return { title: 'Species Not Found' };
  }
  
  const canonical = `${SITE_URL}/species/${slug}`;
  const ogImage = speciesData.sampleThumb;
  
  return {
    title: `${speciesData.name} | Wildphotography`,
    description: speciesData.scientificName 
      ? `Browse ${speciesData.photoCount} photos of ${speciesData.name} (${speciesData.scientificName}) photographed in Costa Rica.`
      : `Browse ${speciesData.photoCount} photos of ${speciesData.name} photographed in Costa Rica.`,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${speciesData.name} | Wildphotography`,
      description: speciesData.scientificName 
        ? `${speciesData.name} (${speciesData.scientificName}) - Costa Rica wildlife photography`
        : `${speciesData.name} - Costa Rica wildlife photography`,
      url: canonical,
      siteName: 'Wildphotography',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: speciesData.name }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${speciesData.name} | Wildphotography`,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function SpeciesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Find species by slug
  const allSpecies = await getAllSpecies();
  const speciesData = allSpecies.find(s => s.slug === slug);
  
  if (!speciesData) {
    notFound();
  }

  const { photos, total } = await getPhotosBySpecies(speciesData.name, 50, 0);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link href="/species" className="text-blue-600 hover:underline">Species</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">{speciesData.name}</li>
        </ol>
      </nav>
      
      {/* Species Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          {speciesData.name}
        </h1>
        
        {speciesData.scientificName && (
          <p className="text-xl text-gray-600 italic mb-2">
            {speciesData.scientificName}
          </p>
        )}
        
        <p className="text-gray-600">
          {total} photo{total !== 1 ? 's' : ''} from Costa Rica
        </p>
      </header>
      
      {/* Photo Grid */}
      {total > 0 ? (
        <VirtualizedGallery 
          photos={photos} 
          columns={4}
        />
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p>No photos of this species yet.</p>
          <Link href="/species" className="text-blue-600 hover:underline mt-2 inline-block">
            Browse other species &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
