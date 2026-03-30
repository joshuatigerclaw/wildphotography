/**
 * PhotoViatorBlock
 *
 * Contextual affiliate text module rendered between keyword chips and
 * the location/metadata row on photo pages.
 *
 * Props:
 *   blurb      — pre-generated contextual copy (~45–70 words) or null
 *   location   — photo's location_name
 *   region     — photo's region
 *   species    — photo's species_common_name
 *   viatorDest — viator destination key for deep link (optional)
 */
interface PhotoViatorBlockProps {
  blurb?: string | null;
  location?: string | null;
  region?:  string | null;
  species?: string | null;
  viatorDest?: string | null;
}

function buildViatorUrl(dest?: string | null): string {
  if (!dest) return 'https://www.viator.com/destinations/costa-rica/things-to-do-c1';
  return `https://www.viator.com/destinations/costa-rica/tours-c1/${dest}`;
}

export default function PhotoViatorBlock({
  blurb,
  location,
  region,
  species,
  viatorDest,
}: PhotoViatorBlockProps) {
  // Graceful fallback — never render an empty or broken block
  if (!blurb || blurb.trim().length < 20) return null;

  const viatorUrl = buildViatorUrl(viatorDest);

  // Derive a useful label from context
  const regionLabel = location || region || 'Costa Rica';
  const ctaLabel = species
    ? `Explore ${species} tours nearby`
    : `Explore tours in ${regionLabel}`;

  return (
    <div className="relative rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm overflow-hidden">
      {/* Subtle decorative accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-bl-full opacity-40 pointer-events-none" />

      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded">
          Travel ideas
        </span>
        <span className="text-xs text-blue-500 font-medium">
          Curated experiences near this location
        </span>
      </div>

      {/* Affiliate copy */}
      <p className="text-sm text-gray-700 leading-relaxed mb-4 pr-6">
        {blurb}
      </p>

      {/* CTA */}
      <div className="flex items-center gap-3">
        <a
          href={viatorUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 transition-colors shadow-sm"
        >
          {ctaLabel}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <span className="text-xs text-gray-400">
          We may earn a small commission — no extra cost to you.
        </span>
      </div>
    </div>
  );
}
