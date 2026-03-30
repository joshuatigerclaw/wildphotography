"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Photo = {
  id: number;
  slug: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  location_name: string | null;
  region: string | null;
  country: string | null;
  gallery_id: number | null;
  gallery_slug: string | null;
  gallery_name: string | null;
  species_common_name: string | null;
  derivatives_complete: boolean;
  ready_for_public_render: boolean;
  search_ready: boolean;
  ai_description_status: string | null;
  ai_description: string | null;
  description_locked: boolean;
  preview_url: string | null;
  thumb_url: string | null;
  medium_url: string | null;
};

function Thumb({ photo }: { photo: Photo }) {
  const src = photo.thumb_url || photo.medium_url || photo.preview_url || "";
  const isAccessible = src.includes("/derivatives/") && !src.match(/\/(thumbs|previews|mediums?)\//);

  return (
    <Link
      href={`/admin/photos/${photo.id}`}
      className="group relative block overflow-hidden rounded-lg border border-gray-800 bg-gray-900 transition-all hover:border-blue-700 hover:ring-1 hover:ring-blue-500/30"
    >
      {src && isAccessible ? (
        <img
          src={src}
          alt={photo.title || photo.slug}
          className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="aspect-square w-full bg-gray-800 flex items-center justify-center">
          <span className="text-3xl text-gray-700">◻</span>
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-start gap-1 p-1.5">
        {photo.search_ready && (
          <span className="rounded bg-blue-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">S</span>
        )}
        {photo.ai_description_status === "accepted" && (
          <span className="rounded bg-green-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">AI</span>
        )}
        {photo.description_locked && (
          <span className="rounded bg-yellow-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">🔒</span>
        )}
        {!photo.derivatives_complete && (
          <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">!d</span>
        )}
      </div>
      <div className="border-t border-gray-800 px-2 py-1.5">
        <div className="truncate text-xs font-medium text-gray-300">{photo.title || photo.slug}</div>
        {photo.gallery_name && (
          <div className="mt-0.5 truncate text-[10px] text-gray-500">{photo.gallery_name}</div>
        )}
        {photo.location_name && (
          <div className="mt-0.5 truncate text-[10px] text-gray-600">{photo.location_name}</div>
        )}
      </div>
    </Link>
  );
}

export default function PhotoLibraryPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-500">Loading…</div>}>
      <PhotoLibraryInner />
    </Suspense>
  );
}

function PhotoLibraryInner() {
  const router = useRouter();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAi, setFilterAi] = useState("");
  const [filterReady, setFilterReady] = useState<string>("");
  const [filterSearchReady, setFilterSearchReady] = useState<string>("");
  const perPage = 48;

  const fetchPhotos = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), perPage: String(perPage), search });
      if (filterAi) params.set("filterAiStatus", filterAi);
      if (filterReady === "true") params.set("filterReady", "true");
      else if (filterReady === "false") params.set("filterReady", "false");
      if (filterSearchReady === "true") params.set("filterSearchReady", "true");
      else if (filterSearchReady === "false") params.set("filterSearchReady", "false");

      const res = await fetch(`/api/admin/photos?${params}`, { credentials: "include" });
      if (!res.ok) { router.push("/admin"); return; }
      const data = await res.json();
      setPhotos(data.photos);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [search, filterAi, filterReady, filterSearchReady, router]);

  useEffect(() => { fetchPhotos(1); setPage(1); }, [fetchPhotos]);

  function handlePage(newPage: number) {
    setPage(newPage);
    fetchPhotos(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="flex items-center gap-4 px-6 py-4">
          <Link href="/admin/dashboard" className="text-sm font-bold text-white hover:text-blue-400">
            WildPhotography Admin
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-400">Photo Library</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-500">{total.toLocaleString()} photos</span>
            <button
              onClick={() => router.push(`/admin/bulk?ids=${photos.map(p => p.id).join(",")}`)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-30"
              disabled={photos.length === 0}
            >
              Bulk Edit {photos.length > 0 ? `(${photos.length})` : ""}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); }}
            placeholder="Search slug, title, keywords…"
            className="flex-1 min-w-48 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <select value={filterReady} onChange={e => setFilterReady(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
            <option value="">All render</option>
            <option value="true">Ready to render</option>
            <option value="false">Not render-ready</option>
          </select>
          <select value={filterSearchReady} onChange={e => setFilterSearchReady(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
            <option value="">All index</option>
            <option value="true">Search indexed</option>
            <option value="false">Not indexed</option>
          </select>
          <select value={filterAi} onChange={e => setFilterAi(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
            <option value="">All AI</option>
            <option value="null">No AI desc</option>
            <option value="generated">Generated</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={() => { setSearch(""); setFilterAi(""); setFilterReady(""); setFilterSearchReady(""); }}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
          >
            Clear
          </button>
        </div>
      </header>

      {/* Grid */}
      <main className="p-6">
        {loading ? (
          <div className="flex h-60 items-center justify-center text-gray-500">Loading…</div>
        ) : photos.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center text-gray-500">
            <span className="text-4xl">◻</span>
            <p className="mt-2 text-sm">No photos found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {photos.map(p => <Thumb key={p.id} photo={p} />)}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button onClick={() => handlePage(page - 1)} disabled={page <= 1}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 disabled:opacity-30">
                  ← Prev
                </button>
                <span className="px-3 text-sm text-gray-500">Page {page} / {totalPages} ({total.toLocaleString()} total)</span>
                <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 disabled:opacity-30">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
