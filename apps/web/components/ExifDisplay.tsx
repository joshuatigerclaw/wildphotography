'use client';

import { useState } from 'react';

export interface ExifData {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  dateTaken?: string;
  location?: string;
  dimensions?: string;
  fileSize?: string;
}

interface ExifDisplayProps {
  exif?: ExifData | null;
}

function ExifRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function ExifDisplay({ exif }: ExifDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!exif || Object.keys(exif).length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
        No EXIF data available for this photo.
      </div>
    );
  }

  const hasContent = exif.camera || exif.lens || exif.focalLength || 
                     exif.aperture || exif.shutterSpeed || exif.iso ||
                     exif.dimensions || exif.fileSize;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900">Camera Details</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 pt-0">
          <ExifRow label="Camera" value={exif.camera} />
          <ExifRow label="Lens" value={exif.lens} />
          <ExifRow label="Focal Length" value={exif.focalLength} />
          <ExifRow label="Aperture" value={exif.aperture} />
          <ExifRow label="Shutter Speed" value={exif.shutterSpeed} />
          <ExifRow label="ISO" value={exif.iso} />
          <ExifRow label="Dimensions" value={exif.dimensions} />
          <ExifRow label="File Size" value={exif.fileSize} />
          {exif.dateTaken && (
            <ExifRow 
              label="Date Taken" 
              value={new Date(exif.dateTaken).toLocaleDateString()} 
            />
          )}
          {exif.location && (
            <ExifRow label="Location" value={exif.location} />
          )}
        </div>
      </div>
    </div>
  );
}

export default ExifDisplay;
