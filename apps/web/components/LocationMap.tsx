'use client';

interface LocationMapProps {
  lat: number;
  lon: number;
  locationName?: string;
  zoom?: number;
}

export default function LocationMap({ lat, lon, locationName, zoom = 10 }: LocationMapProps) {
  // Don't Render if no valid coordinates
  if (!lat || !lon || lat === 0 || lon === 0) {
    return null;
  }

  // Use OpenStreetMap static tile as a simple map display
  // Center on the coordinates
  const centerLat = lat;
  const centerLon = lon;

  return (
    <div className="space-y-3">
      {locationName && (
        <p className="text-gray-600 flex items-center gap-2">
          <span className="text-lg">📍</span>
          {locationName}
        </p>
      )}
      
      {/* Static map using OpenStreetMap tiles with marker */}
      <div className="relative rounded-xl overflow-hidden shadow-md">
        <img
          src={`https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLon}&zoom=${zoom}&size=600x300&markers=${centerLat},${centerLon},red-pushpin`}
          alt={`Map showing ${locationName || 'photo location'}`}
          className="w-full h-auto"
        />
        
        {/* Fallback link to view on OSM */}
        <a 
          href={`https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLon}#map=${zoom}/${centerLat}/${centerLon}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 rounded text-xs text-gray-600 hover:bg-white"
        >
          View on OpenStreetMap ↗
        </a>
      </div>
      
      <p className="text-xs text-gray-400 text-center">
        © OpenStreetMap contributors
      </p>
    </div>
  );
}
