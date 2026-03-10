import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getPhotoBySlug, getGalleries, getRelatedPhotos, getPhotosFromGallery } from '@/lib/db';
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
      description: photo.description || undefined,
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

  // Get related photos (by keywords)
  let relatedPhotos: any[] = [];
  try {
    relatedPhotos = await getRelatedPhotos(slug, undefined, photo.keywords || '', 8);
  } catch (e) {
    console.error('Error fetching related photos:', e);
  }

  // Get photos from same gallery
  let galleryPhotos: any[] = [];
  try {
    // Find which gallery this photo belongs to
    const galleries = await getGalleries();
    for (const gallery of galleries) {
      const photos = await getPhotosFromGallery(gallery.slug, slug, 8);
      if (photos.length > 0) {
        galleryPhotos = photos;
        break;
      }
    }
  } catch (e) {
    console.error('Error fetching gallery photos:', e);
  }

  // Generate JSON-LD
  const jsonLd = generatePhotoJsonLd({
    title: photo.title,
    description: photo.description || undefined,
    imageUrl: photo.mediumUrl || photo.smallUrl || '',
    dateTaken: photo.date_taken ? new Date(photo.date_taken) : undefined,
    location: photo.locationName || undefined,
    width: photo.width || undefined,
    height: photo.height || undefined,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PhotoPageClient 
        photo={photo} 
        relatedPhotos={relatedPhotos}
        galleryPhotos={galleryPhotos}
      />
    </>
  );
}
