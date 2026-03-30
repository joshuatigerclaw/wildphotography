interface AffiliateBlockProps {
  entityType: 'location' | 'region' | 'species' | 'article';
  entityId: number;
  provider: 'gyg' | 'viator';
  title: string;
  destinationKey?: string;
  shortcode?: string;
  className?: string;
}

function buildAffiliateUrl(
  provider: 'gyg' | 'viator',
  destinationKey?: string,
  shortcode?: string
): string {
  if (shortcode) return shortcode;
  if (provider === 'gyg' && destinationKey) {
    return `https://www.getyourguide.com/${destinationKey}`;
  }
  if (provider === 'viator' && destinationKey) {
    return `https://www.viator.com/destinations/costa-rica/tours/${destinationKey}`;
  }
  return '#';
}

export default function AffiliateBlock({
  provider,
  title,
  destinationKey,
  shortcode,
  className = '',
}: AffiliateBlockProps) {
  const url = buildAffiliateUrl(provider, destinationKey, shortcode);
  const isGyg = provider === 'gyg';

  return (
    <div className={`border border-amber-200 bg-amber-50 rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-block px-2 py-0.5 text-xs font-semibold text-white rounded ${
            isGyg ? 'bg-orange-500' : 'bg-blue-600'
          }`}
        >
          {isGyg ? 'GetYourGuide' : 'Viator'}
        </span>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`inline-block px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${
          isGyg
            ? 'bg-orange-500 hover:bg-orange-600'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isGyg ? 'Find Tours' : 'View Activities'}
      </a>

      <p className="text-xs text-gray-400 mt-2">
        We may earn a small commission at no extra cost to you.
      </p>
    </div>
  );
}
