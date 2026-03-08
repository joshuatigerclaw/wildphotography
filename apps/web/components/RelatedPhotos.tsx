import Link from 'next/link';

export interface RelatedPhoto {
  id: string;
  slug: string;
  title: string;
  thumbUrl?: string | null;
}

interface RelatedPhotosProps {
  photos: RelatedPhoto[];
  title?: string;
}

export function RelatedPhotos({ photos, title = 'Related Photos' }: RelatedPhotosProps) {
  if (!photos || photos.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Link
            key={photo.id}
            href={`/photo/${photo.slug}`}
            className="group block"
          >
            <div className="aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden">
              <img
                src={photo.thumbUrl || '/placeholder.jpg'}
                alt={photo.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            <h3 className="text-sm font-medium mt-2 group-hover:text-blue-600 truncate">
              {photo.title}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default RelatedPhotos;
