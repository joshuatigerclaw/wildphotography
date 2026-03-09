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
          height: 1200,
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
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm mb-6">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/galleries" className="text-blue-600 hover:underline">Galleries</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{gallery.name}</span>
      </nav>
      
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{gallery.name}</h1>
        {gallery.description && (
          <p className="text-gray-600 text-lg">{gallery.description}</p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          {total > 0 ? `${total} photos` : 'No photos'}
        </p>
      </header>
      
      <VirtualizedGallery 
        photos={photos} 
        columns={4}
      />
    </div>
  );
}
