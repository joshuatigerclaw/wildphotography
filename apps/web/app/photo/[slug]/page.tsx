import { notFound } from 'next/navigation';
import { getPhotoBySlug } from '@/lib/db';
import PhotoPageClient from './PhotoPageClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  if (!photo) return { title: 'Photo Not Found' };
  return { 
    title: `${photo.title} | Wildphotography`, 
    description: photo.description
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  
  if (!photo) {
    notFound();
  }

  return <PhotoPageClient photo={photo} />;
}
