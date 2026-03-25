import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import {
  getPhotoBySlug,
  getRelatedPhotos,
  getPhotosFromGallery,
  getGalleryForPhoto,
  getGallerySequenceForPhoto,
} from '@/lib/db';
import { generatePhotoJsonLd, canonicalUrl } from '@/lib/seo';
import { getDisplayTitle } from '@/lib/titles';
import PhotoPageClient from './PhotoPageClient';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://wildphotography.com';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return { title: 'Photo Not Found' };
  }

  const displayTitle = getDisplayTitle(photo.title);
  const gallery = await getGalleryForPhoto(slug);

  const canonical = canonicalUrl(`/photo/${photo.slug}`);
  const ogImage = photo.mediumUrl || photo.smallUrl || photo.thumbUrl;

  let description = photo.description || '';
  if (!description && photo.locationName) {
    description = `${displayTitle || 'Photo'} from ${photo.locationName}, Costa Rica`;
  }
  if (!description && gallery) {
    description = `${displayTitle || 'Photo'} in ${gallery.name} gallery`;
  }

  return {
    title: `${displayTitle || 'Photo'} | Wildphotography`,
    description: description || `Beautiful nature photography from Costa Rica`,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical },
    openGraph: {
      title: displayTitle || 'Photo',
      description: description || `Beautiful nature photography from Costa Rica`,
      url: canonical,
      siteName: 'Wildphotography',
      images: ogImage
        ? [{ url: ogImage, width: photo.width || 1200, height: photo.height || 800, alt: displayTitle || 'Photo' }]
        : [],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle || 'Photo',
      description: description || undefined,
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

  // Gallery context
  const gallery = await getGalleryForPhoto(slug);

  // Gallery sequence (prev / next navigation)
  let sequence = null;
  if (gallery) {
    try {
      sequence = await getGallerySequenceForPhoto(slug, gallery.id);
    } catch (e) {
      console.error('Error fetching gallery sequence:', e);
    }
  }

  // Related photos by keywords / gallery
  let relatedPhotos: any[] = [];
  try {
    relatedPhotos = await getRelatedPhotos(slug, undefined, photo.keywords || '', 8);
  } catch (e) {
    console.error('Error fetching related photos:', e);
  }

  // More photos from same gallery
  let galleryPhotos: any[] = [];
  if (gallery) {
    try {
      galleryPhotos = await getPhotosFromGallery(gallery.slug, slug, 8);
    } catch (e) {
      console.error('Error fetching gallery photos:', e);
    }
  }

  // JSON-LD structured data
  const displayTitle = getDisplayTitle(photo.title);
  const jsonLd = generatePhotoJsonLd({
    title: displayTitle,
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
        gallery={gallery}
        sequence={sequence}
      />
    </>
  );
}
