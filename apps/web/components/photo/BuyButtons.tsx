import Link from "next/link";

export function BuyButtons({ photoSlug }: { photoSlug: string }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Link
        href={`/buy/${photoSlug}?license=web`}
        className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-center font-medium text-white hover:bg-gray-700 transition-colors"
      >
        Buy Web Download – $9
      </Link>

      <Link
        href={`/buy/${photoSlug}?license=full`}
        className="rounded-xl border border-green-700 bg-green-700 px-4 py-3 text-center font-medium text-white hover:bg-green-600 transition-colors"
      >
        Buy Full Resolution – $19
      </Link>
    </div>
  );
}
