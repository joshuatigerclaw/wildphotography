"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type Photo = {
  id: number;
  slug: string;
  title: string | null;
  gallery_name: string | null;
  keywords: string | null;
  search_ready: boolean;
  ready_for_public_render: boolean;
};

type Gallery = { id: number; name: string; slug: string; photo_count: number };

function BulkEditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get("ids") || "";
  const ids: number[] = idsParam
    ? idsParam.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    : [];

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ updated: number } | null>(null);
  const [error, setError] = useState("");

  // Bulk fields
  const [keywords, setKeywords] = useState("");
  const [keywordsMode, setKeywordsMode] = useState<"replace" | "append" | "clear">("replace");
  const [gallerySlug, setGallerySlug] = useState("");
  const [galleryName, setGalleryName] = useState("");
  const [searchReady, setSearchReady] = useState<boolean | null>(null);
  const [readyForRender, setReadyForRender] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ids.length) { setLoading(false); return; }
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        ids.forEach(id => params.append("ids", String(id)));
        // Fetch each photo individually for now (simple approach)
        const photosData: Photo[] = [];
        for (const id of ids) {
          const res = await fetch(`/api/admin/photos/${id}`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            photosData.push(data.photo);
          }
        }
        setPhotos(photosData);

        // Load galleries
        const galRes = await fetch("/api/admin/galleries", { credentials: "include" });
        if (galRes.ok) {
          const galData = await galRes.json();
          setGalleries(galData.galleries || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ids]);

  async function handleSave() {
    if (!ids.length) return;
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const body: Record<string, unknown> = { ids };

      if (keywordsMode === "clear") body.keywords = "";
      else if (keywordsMode === "replace" && keywords) body.keywords = keywords;
      else if (keywordsMode === "append" && keywords) {
        // For append, set a prefix that the API recognizes
        body.keywords = `__append:${keywords}`;
      }

      if (gallerySlug) body.gallery_slug = gallerySlug;
      if (searchReady !== null) body.search_ready = searchReady;
      if (readyForRender !== null) body.ready_for_public_render = readyForRender;

      const res = await fetch("/api/admin/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bulk update failed");
      } else {
        setResult({ updated: data.updated });
        // Refresh photos
        setTimeout(() => {
          const refreshed = photos.map(p => ({ ...p }));
          setPhotos(refreshed);
        }, 500);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!ids.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <span className="text-5xl">▢</span>
        <p className="mt-3 text-lg font-medium">No photos selected</p>
        <Link href="/admin/photos" className="mt-3 text-sm text-blue-400 hover:text-blue-300">
          Go to Photo Library →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/photos" className="text-sm text-gray-500 hover:text-white">Admin</Link>
            <span className="mx-2 text-gray-700">/</span>
            <span className="text-sm font-medium text-white">Bulk Editor</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{ids.length} photos selected</span>
            {result && (
              <span className="rounded bg-green-900/60 px-3 py-1 text-sm text-green-300">
                ✓ {result.updated} updated
              </span>
            )}
            {error && (
              <span className="rounded bg-red-900/60 px-3 py-1 text-sm text-red-300">{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !!result}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Apply Changes"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex gap-6 p-6">
        {/* Left: bulk actions */}
        <div className="w-72 shrink-0 space-y-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
            <div className="text-sm font-semibold text-white">Bulk Operations</div>

            {/* Keywords */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Keywords</label>
              <select
                value={keywordsMode}
                onChange={e => setKeywordsMode(e.target.value as "replace" | "append" | "clear")}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="replace">Replace all</option>
                <option value="append">Append (add to existing)</option>
                <option value="clear">Clear all</option>
              </select>
              {keywordsMode !== "clear" && (
                <input
                  type="text"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="e.g. costa rica, bird, wildlife"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>

            {/* Gallery */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gallery</label>
              <select
                value={gallerySlug}
                onChange={e => {
                  setGallerySlug(e.target.value);
                  const g = galleries.find(g => g.slug === e.target.value);
                  setGalleryName(g?.name || "");
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">— No change —</option>
                {galleries.map(g => (
                  <option key={g.id} value={g.slug}>{g.name} ({g.photo_count})</option>
                ))}
              </select>
            </div>

            {/* Search Ready */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Search Ready</label>
              <select
                value={searchReady === null ? "" : searchReady ? "true" : "false"}
                onChange={e => setSearchReady(e.target.value === "" ? null : e.target.value === "true")}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">— No change —</option>
                <option value="true">Set to true</option>
                <option value="false">Set to false</option>
              </select>
              <p className="text-[10px] text-yellow-600">
                ⚠ Note: bulk setting search_ready=true is disabled to prevent incorrect indexing
              </p>
            </div>

            {/* Ready for Render */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ready to Render</label>
              <select
                value={readyForRender === null ? "" : readyForRender ? "true" : "false"}
                onChange={e => setReadyForRender(e.target.value === "" ? null : e.target.value === "true")}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">— No change —</option>
                <option value="true">Set to true</option>
                <option value="false">Set to false</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Applying…" : "Apply Changes"}
          </button>
        </div>

        {/* Right: selected photos list */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 text-sm text-gray-500">
            {loading ? "Loading…" : `${photos.length} photos in selection`}
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-gray-500">Loading photos…</div>
          ) : (
            <div className="space-y-2">
              {photos.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5">
                  <Link href={`/admin/photos/${p.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{p.title || p.slug}</div>
                    <div className="text-xs text-gray-500">
                      id={p.id} · {p.gallery_name || "uncategorized"}
                      {p.keywords && <span className="ml-2 text-gray-600">· {p.keywords.slice(0, 60)}</span>}
                    </div>
                  </Link>
                  <div className="flex gap-1.5 shrink-0">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${p.search_ready ? "bg-blue-900/60 text-blue-300" : "bg-gray-800 text-gray-600"}`}>
                      S={p.search_ready ? "✓" : "✗"}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${p.ready_for_public_render ? "bg-green-900/60 text-green-300" : "bg-gray-800 text-gray-600"}`}>
                      R={p.ready_for_public_render ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BulkEditorPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>}>
      <BulkEditorContent />
    </Suspense>
  );
}
