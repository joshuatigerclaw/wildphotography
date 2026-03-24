import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getGalleryBySlug, getPhotosByGallery } from '@/lib/db';
import { canonicalUrl } from '@/lib/seo';
import VirtualizedGallery from '@/components/VirtualizedGallery';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await getGalleryBySlug(slug);
  
  if (!gallery) {
    return { title: 'Gallery Not Found' };
  }
  
  const canonical = canonicalUrl(`/gallery/${gallery.slug}`);
  const ogImage = gallery.coverPhotoUrl;
  
  return {
    title: `${gallery.name} | Wildphotography`,
    description: gallery.description || `${gallery.name} - ${gallery.photoCount} beautiful nature photography images from Costa Rica`,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: canonical,
    },
    openGraph: {
      title: `${gallery.name} | Wildphotography`,
      description: gallery.description || `${gallery.name} - ${gallery.photoCount} photos from Costa Rica`,
      url: canonical,
      siteName: 'Wildphotography',
      images: ogImage ? [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: gallery.name,
        }
      ] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${gallery.name} | Wildphotography`,
      description: gallery.description || undefined,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = await getGalleryBySlug(slug);
  
  if (!gallery) {
    notFound();
  }

  const { photos, total } = await getPhotosByGallery(slug, 50, 0);

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
            <Link href="/galleries" className="text-blue-600 hover:underline">Galleries</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600" aria-current="page">{gallery.name}</li>
        </ol>
      </nav>
      
      {/* Gallery Header - Premium Editorial Style */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          {gallery.name}
        </h1>
        
        {gallery.description && (
          <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
            {gallery.description}
          </p>
        )}
        
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <span className="font-medium">
            {total > 0 ? `${total} photo${total !== 1 ? 's' : ''}` : 'No photos'}
          </span>
          {gallery.photoCount > 0 && (
            <>
              <span>•</span>
              <span>Costa Rica</span>
            </>
          )}
        </div>
      </header>
      
      {/* Photo Grid */}
      {total > 0 ? (
        <VirtualizedGallery 
          photos={photos} 
          columns={4}
        />
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p>No photos in this gallery yet.</p>
          <Link href="/galleries" className="text-blue-600 hover:underline mt-2 inline-block">
            Browse other galleries &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
