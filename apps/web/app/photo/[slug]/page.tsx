import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getPhotoBySlug } from '@/lib/db';
import { generatePhotoJsonLd, canonicalUrl } from '@/lib/seo';
import PhotoPageClient from './PhotoPageClient';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  
  if (!photo) {
    return { title: 'Photo Not Found' };
  }
  
  const canonical = canonicalUrl(`/photo/${photo.slug}`);
  const ogImage = photo.mediumUrl || photo.smallUrl || photo.thumbUrl;
  
  return {
    title: `${photo.title} | Wildphotography`,
    description: photo.description || `Beautiful ${photo.title} photograph from Costa Rica`,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: canonical,
    },
    openGraph: {
      title: photo.title,
      description: photo.description || `Beautiful ${photo.title} photograph from Costa Rica`,
      url: canonical,
      siteName: 'Wildphotography',
      images: ogImage ? [
        {
          url: ogImage,
          width: photo.width || 1200,
          height: photo.height || 800,
          alt: photo.title,
        }
      ] : [],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: photo.title,
      description: photo.description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  
  if (!photo) {
    notFound();
  }

  // Generate JSON-LD
  const jsonLd = generatePhotoJsonLd({
    title: photo.title,
    description: photo.description || undefined,
    imageUrl: photo.mediumUrl || photo.smallUrl || '',
    dateTaken: photo.dateTaken,
    location: photo.location || undefined,
    width: photo.width || undefined,
    height: photo.height || undefined,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PhotoPageClient photo={photo} />
    </>
  );
}
