"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LICENSES } from "@/lib/pricing";
import type { LicenseKey } from "@/lib/pricing";

interface PhotoSummary {
  id: string;
  slug: string;
  title: string | null;
  thumbUrl: string | null;
  gallery_slug: string;
  gallery_title: string;
}

export default function BuyPageClient({
  photo,
}: {
  photo: PhotoSummary;
}) {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const licenseType = (searchParams.get("license") || "web") as LicenseKey;

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerNotes, setBuyerNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = LICENSES[licenseType] || LICENSES.web;
  const photoTitle = photo.title || params.slug.replace(/-/g, " ");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_notes: buyerNotes,
      photo_id: photo.id,
      photo_slug: photo.slug,
      photo_title: photoTitle,
      gallery_slug: photo.gallery_slug,
      gallery_title: photo.gallery_title,
      license_type: licenseType,
      source_page_type: "photo_page",
      source_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://wildphotography.com"}/photo/${photo.slug}`,
      referrer_url: "",
      utm_source: searchParams.get("utm_source") || "",
      utm_medium: searchParams.get("utm_medium") || "",
      utm_campaign: searchParams.get("utm_campaign") || "",
    };

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Unable to start order");
        setLoading(false);
        return;
      }

      window.location.href = data.paypalUrl;
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/photo/${photo.slug}`}
        className="inline-flex items-center text-sm text-blue-600 hover:underline mb-6"
      >
        ← Back to photo
      </Link>

      <h1 className="text-2xl font-bold">Purchase Photo</h1>

      {/* Photo preview */}
      <div className="mt-4 rounded-xl border overflow-hidden bg-white">
        {photo.thumbUrl && (
          <div className="relative h-48 w-full bg-gray-100">
            <Image
              src={photo.thumbUrl}
              alt={photoTitle}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <div className="p-4">
          <div className="font-semibold text-lg">{photoTitle}</div>
          {photo.gallery_title && (
            <div className="text-sm text-gray-500 mt-1">
              Gallery: {photo.gallery_title}
            </div>
          )}
        </div>
      </div>

      {/* License selection */}
      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="font-medium text-blue-900 mb-1">{selected.label}</div>
        <div className="text-2xl font-bold text-blue-700">${selected.price} USD</div>
        <div className="mt-2 flex gap-2">
          <Link
            href={`/buy/${photo.slug}?license=web`}
            className={`text-xs px-3 py-1 rounded-full border ${
              licenseType === "web"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 text-gray-500 hover:border-blue-400"
            }`}
          >
            Web — $9
          </Link>
          <Link
            href={`/buy/${photo.slug}?license=full`}
            className={`text-xs px-3 py-1 rounded-full border ${
              licenseType === "full"
                ? "border-green-600 bg-green-600 text-white"
                : "border-gray-300 text-gray-500 hover:border-green-400"
            }`}
          >
            Full — $19
          </Link>
        </div>
      </div>

      {/* Order form */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your name <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="Jane Smith"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email for delivery <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="email"
            placeholder="jane@example.com"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            We&apos;ll send the download link here after payment verification.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            placeholder="Any special requests..."
            value={buyerNotes}
            onChange={(e) => setBuyerNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-blue-600 text-white px-6 py-4 font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading
            ? "Redirecting to PayPal..."
            : `Continue to PayPal — $${selected.price}`}
        </button>

        <p className="text-center text-xs text-gray-400">
          Secure payment via PayPal. You don&apos;t need a PayPal account — PayPal accepts credit cards.
        </p>
      </form>
    </main>
  );
}
