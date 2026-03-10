'use client';

interface LocationMapProps {
  lat: number;
  lon: number;
  locationName?: string;
  zoom?: number;
}

export default function LocationMap({ lat, lon, locationName, zoom = 10 }: LocationMapProps) {
  // Don't render if no valid coordinates
  if (!lat || !lon || lat === 0 || lon === 0) {
    return null;
  }

  // Use OpenStreetMap embed iframe - simplest approach that works
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01}%2C${lat-0.01}%2C${lon+0.01}%2C${lat+0.01}&layer=mapnik&marker=${lat}%2C${lon}`;

  return (
    <div className="space-y-3">
      {locationName && (
        <p className="text-gray-600 flex items-center gap-2">
          <span className="text-lg">📍</span>
          {locationName}
        </p>
      )}
      
      <div className="rounded-xl overflow-hidden shadow-md">
        <iframe
          width="100%"
          height="300"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={embedUrl}
          style={{ border: 'none' }}
          title={`Map of ${locationName || 'photo location'}`}
        />
      </div>
      
      <a 
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 text-sm hover:underline"
      >
        View on OpenStreetMap ↗
      </a>
    </div>
  );
}
