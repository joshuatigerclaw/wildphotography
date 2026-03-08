import Link from 'next/link';
import { notFound } from 'next/navigation';
import PhotoPageClient from './PhotoPageClient';

// Types
interface PhotoData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  longDescription?: string;
  thumbUrl?: string | null;
  smallUrl?: string | null;
  mediumUrl?: string | null;
  largeUrl?: string | null;
  originalUrl?: string | null;
  locationName?: string | null;
  keywords?: string[];
  gallerySlug?: string;
  galleryName?: string;
  exif?: {
    camera?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: string;
    dateTaken?: string;
    dimensions?: string;
  };
}

// Mock data - replace with DB query
const mockPhotos: Record<string, PhotoData> = {
  'scarlet-macaw': {
    id: '1',
    slug: 'scarlet-macaw',
    title: 'Scarlet Macaw',
    description: 'A stunning Scarlet Macaw photographed in Carara, Costa Rica.',
    longDescription: 'The Scarlet Macaw (Ara macao) is a large, colorful parrot native to Central and South America. This magnificent bird was photographed in the tropical forests of Carara National Park, known for its rich biodiversity. Scarlet Macaws are known for their brilliant red, yellow, and blue plumage, making them one of the most recognizable birds in the Americas.',
    thumbUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400',
    smallUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    mediumUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200',
    largeUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600',
    originalUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3',
    locationName: 'Carara National Park, Costa Rica',
    keywords: ['scarlet macaw', 'macaw', 'parrot', 'tropical bird', 'Costa Rica', 'wildlife', 'nature'],
    gallerySlug: 'birds',
    galleryName: 'Birds of Costa Rica',
    exif: {
      camera: 'Canon EOS R5',
      lens: 'RF 100-500mm f/4.5-7.1L',
      focalLength: '450mm',
      aperture: 'f/6.3',
      shutterSpeed: '1/1000s',
      iso: '800',
      dimensions: '8192 x 5464',
    },
  },
  'quetzal': {
    id: '2',
    slug: 'quetzal',
    title: 'Resplendent Quetzal',
    description: 'The legendary Resplendent Quetzal in Costa Rica\'s cloud forests.',
    longDescription: 'The Resplendent Quetzal (Pharomachrus mocinno) is arguably the most beautiful bird in the Americas. Found in the cloud forests of Monteverde and San Gerardo de Dota, these birds are known for their iridescent green plumage and spectacular tail feathers that can reach up to three feet in length.',
    thumbUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=400',
    smallUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=800',
    mediumUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1200',
    largeUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=1600',
    originalUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731',
    locationName: 'Monteverde Cloud Forest, Costa Rica',
    keywords: ['quetzal', 'resplendent quetzal', 'cloud forest', 'bird', 'Costa Rica', 'rare'],
    gallerySlug: 'birds',
    galleryName: 'Birds of Costa Rica',
    exif: {
      camera: 'Sony A1',
      lens: 'FE 200-600mm f/5.6-6.3 G',
      focalLength: '600mm',
      aperture: 'f/6.3',
      shutterSpeed: '1/500s',
      iso: '1600',
      dimensions: '8640 x 5760',
    },
  },
  toucan: {
    id: '3',
    slug: 'toucan',
    title: 'Keel-billed Toucan',
    description: 'The colorful Keel-billed Toucan of Costa Rica.',
    longDescription: 'The Keel-billed Toucan (Ramphastos sulfuratus) is one of the most recognizable birds in Costa Rica. Known for its massive, colorful bill, this species inhabits the tropical forests of the Caribbean lowlands.',
    thumbUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400',
    smallUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=800',
    mediumUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1200',
    largeUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=1600',
    locationName: 'Manuel Antonio, Costa Rica',
    keywords: ['toucan', 'tropical bird', 'Costa Rica'],
    gallerySlug: 'birds',
    galleryName: 'Birds of Costa Rica',
  },
  sloth: {
    id: '4',
    slug: 'sloth',
    title: 'Three-toed Sloth',
    description: 'A peaceful sloth in the Costa Rican rainforest.',
    longDescription: 'The Three-toed Sloth (Bradypus variegatus) is one of the most iconic mammals of Costa Rica. Found in the rainforests throughout the country, these gentle creatures spend most of their time hanging from trees.',
    thumbUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400',
    smallUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=800',
    mediumUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1200',
    largeUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=1600',
    locationName: 'Manuel Antonio, Costa Rica',
    keywords: ['sloth', 'mammal', 'wildlife', 'Costa Rica'],
    gallerySlug: 'wildlife',
    galleryName: 'Wildlife',
  },
};

// Related photos mock
const relatedPhotos: PhotoData[] = [
  { id: '3', slug: 'toucan', title: 'Keel-billed Toucan', thumbUrl: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=400' },
  { id: '4', slug: 'sloth', title: 'Three-toed Sloth', thumbUrl: 'https://images.unsplash.com/photo-1599388167667-4a1122bc13d4?w=400' },
  { id: '5', slug: 'monkey', title: 'Capuchin Monkey', thumbUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=400' },
  { id: '6', slug: 'iguana', title: 'Green Iguana', thumbUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400' },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = mockPhotos[slug];
  if (!photo) return { title: 'Photo Not Found' };
  return {
    title: `${photo.title} | Wildphotography`,
    description: photo.description,
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = mockPhotos[slug];

  if (!photo) {
    notFound();
  }

  // Build lightbox slides
  const lightboxSlides = [
    {
      id: photo.id,
      src: photo.largeUrl || photo.mediumUrl || photo.smallUrl || '',
      alt: photo.title,
      title: photo.title,
    },
  ];

  // Serialize data for client component
  const pageProps = {
    photo,
    lightboxSlides,
    relatedPhotos: relatedPhotos.filter(p => p.id !== photo.id).slice(0, 4),
  };

  return <PhotoPageClient {...pageProps} />;
}
