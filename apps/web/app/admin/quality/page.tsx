"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Issue = {
  id: number;
  slug: string;
  issue_type: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  gallery_slug: string | null;
  search_ready: boolean;
  ready_for_public_render: boolean;
  derivatives_complete: boolean;
  ai_description_status: string | null;
  thumb_url: string | null;
};

const ISSUE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  missing_derivatives:        { label: "Missing Derivatives",     color: "text-red-400",    bg: "bg-red-950/40 border-red-900" },
  missing_ai_description:      { label: "Missing AI Description", color: "text-yellow-400", bg: "bg-yellow-950/40 border-yellow-900" },
  weak_description:             { label: "Weak Description",         color: "text-orange-400", bg: "bg-orange-950/40 border-orange-900" },
  ai_description_failed:       { label: "AI Description Failed",    color: "text-red-400",    bg: "bg-red-950/40 border-red-900" },
  weak_keywords:               { label: "Weak Keywords",            color: "text-amber-400",  bg: "bg-amber-950/40 border-amber-900" },
  search_ready_but_not_renderable: { label: "Indexed — Missing Derivatives", color: "text-blue-400", bg: "bg-blue-950/40 border-blue-900" },
  renderable_but_not_searchable:  { label: "Renderable — Not Indexed",      color: "text-purple-400", bg: "bg-purple-950/40 border-purple-900" },
  other:                        { label: "Other Issue",             color: "text-gray-400",   bg: "bg-gray-900 border-gray-800" },
};

export default function QualityQueuePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterDerivatives, setFilterDerivatives] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) return;
      // Quality queue is fetched differently — use a dedicated endpoint
      const qRes = await fetch("/api/admin/quality", { credentials: "include" });
      if (qRes.ok) {
        const data = await qRes.json();
        setIssues(data.issues || []);
      } else {
        // Fallback: show empty and let user navigate
        setIssues([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const filtered = issues.filter(i => {
    if (filterType && i.issue_type !== filterType) return false;
    if (filterDerivatives && i.issue_type !== "missing_derivatives") return false;
    return true;
  });

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-white">Admin</Link>
            <span className="mx-2 text-gray-700">/</span>
            <span className="text-sm font-medium text-white">Quality Review Queue</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{filtered.length} issues</span>
            {selected.size > 0 && (
              <Link
                href={`/admin/bulk?ids=${Array.from(selected).join(",")}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Bulk Edit ({selected.size})
              </Link>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType("")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${!filterType ? "border-blue-600 bg-blue-950 text-blue-300" : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"}`}
          >
            All
          </button>
          {Object.entries(ISSUE_LABELS).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setFilterType(filterType === key ? "" : key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${filterType === key ? `border-blue-600 bg-blue-950 ${val.color}` : `border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600`}`}
            >
              {val.label}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <span className="text-5xl">✓</span>
            <p className="mt-3 text-lg font-medium">No quality issues found</p>
            <p className="mt-1 text-sm">All photos are in good shape.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="mb-1 flex items-center gap-3 px-1">
              <input
                type="checkbox"
                checked={selected.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
                className="rounded border-gray-600 bg-gray-800 text-blue-500"
              />
              <span className="text-xs text-gray-600">Select all</span>
            </div>

            {filtered.map(issue => {
              const info = ISSUE_LABELS[issue.issue_type] || ISSUE_LABELS.other;
              const src = issue.thumb_url || "";
              const srcOk = src.includes("/derivatives/") && !src.match(/\/(thumbs|previews|mediums?)\//);

              return (
                <div
                  key={issue.id}
                  className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${info.bg} transition-colors`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(issue.id)}
                    onChange={() => toggleSelect(issue.id)}
                    className="shrink-0 rounded border-gray-600 bg-gray-800 text-blue-500"
                  />

                  {/* Thumbnail */}
                  <div className="shrink-0">
                    {srcOk ? (
                      <img src={src} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-gray-600">◻</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/photos/${issue.id}`}
                        className="text-sm font-medium text-white hover:text-blue-400"
                      >
                        {issue.title || issue.slug}
                      </Link>
                      <span className={`text-xs font-bold ${info.color}`}>{info.label}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <span>id={issue.id}</span>
                      {issue.gallery_slug && <span>{issue.gallery_slug}</span>}
                      {issue.keywords && <span className="truncate max-w-48">{issue.keywords}</span>}
                      {!issue.derivatives_complete && <span className="text-red-400">no derivatives</span>}
                      {!issue.search_ready && issue.ready_for_public_render && <span className="text-purple-400">not indexed</span>}
                    </div>
                  </div>

                  {/* Status pills */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!issue.derivatives_complete && (
                      <span className="rounded bg-red-900/60 px-2 py-0.5 text-[10px] font-bold text-red-300">!d</span>
                    )}
                    {issue.search_ready && (
                      <span className="rounded bg-blue-900/60 px-2 py-0.5 text-[10px] font-bold text-blue-300">S</span>
                    )}
                    {issue.ready_for_public_render && (
                      <span className="rounded bg-green-900/60 px-2 py-0.5 text-[10px] font-bold text-green-300">R</span>
                    )}
                    {issue.ai_description_status === "accepted" && (
                      <span className="rounded bg-green-900/60 px-2 py-0.5 text-[10px] font-bold text-green-300">AI</span>
                    )}
                    <Link
                      href={`/admin/photos/${issue.id}`}
                      className="ml-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-500 hover:text-white"
                    >
                      Edit →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
