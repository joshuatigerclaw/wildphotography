"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  species_scientific_name: string | null;
  derivatives_complete: boolean;
  ready_for_public_render: boolean;
  search_ready: boolean;
  ai_description_status: string | null;
  ai_description: string | null;
  description_locked: boolean;
  preview_url: string | null;
  thumb_url: string | null;
  medium_url: string | null;
  source_path: string | null;
  original_r2_key: string | null;
  ai_description_source: string | null;
  ai_description_model: string | null;
  ai_description_word_count: number | null;
  ai_description_version: string | null;
  ai_description_review_notes: string | null;
  ai_description_generated_at: string | null;
  description_last_manual_edit_at: string | null;
  camera_model: string | null;
  lens_model: string | null;
  date_taken: string | null;
  date_uploaded: string | null;
};

type HistoryEntry = {
  id: number;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  edited_at: string;
};

function Field({
  label, value, onChange, multiline, rows,
}: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows || 4}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}

export default function PhotoDetailPage({ params }: { params: { id: string } }) {
  const photoId = parseInt(params.id);
  const router = useRouter();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Editable form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [locationName, setLocationName] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [gallerySlug, setGallerySlug] = useState("");
  const [speciesCommon, setSpeciesCommon] = useState("");
  const [speciesScientific, setSpeciesScientific] = useState("");
  const [searchReady, setSearchReady] = useState(false);
  const [readyForRender, setReadyForRender] = useState(false);
  const [descriptionLocked, setDescriptionLocked] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [aiStatus, setAiStatus] = useState("");

  const [activeTab, setActiveTab] = useState<"edit" | "history">("edit");

  const fetchPhoto = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}`, { credentials: "include" });
      if (!res.ok) { router.push("/admin"); return; }
      const data = await res.json();
      const p = data.photo as Photo;
      setPhoto(p);
      setHistory(data.history || []);
      setTitle(p.title || "");
      setDescription(p.description || "");
      setKeywords(p.keywords || "");
      setLocationName(p.location_name || "");
      setRegion(p.region || "");
      setCountry(p.country || "");
      setGallerySlug(p.gallery_slug || "");
      setSpeciesCommon(p.species_common_name || "");
      setSpeciesScientific(p.species_scientific_name || "");
      setSearchReady(p.search_ready);
      setReadyForRender(p.ready_for_public_render);
      setDescriptionLocked(p.description_locked);
      setReviewNotes(p.ai_description_review_notes || "");
      setAiStatus(p.ai_description_status || "");
    } finally {
      setLoading(false);
    }
  }, [photoId, router]);

  useEffect(() => { fetchPhoto(); }, [fetchPhoto]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          keywords: keywords || null,
          location_name: locationName || null,
          region: region || null,
          country: country || null,
          gallery_slug: gallerySlug || null,
          species_common_name: speciesCommon || null,
          species_scientific_name: speciesScientific || null,
          search_ready: searchReady,
          ready_for_public_render: readyForRender,
          description_locked: descriptionLocked,
          ai_description_review_notes: reviewNotes || null,
          ai_description_status: aiStatus || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await fetchPhoto();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>;
  }
  if (!photo) return null;

  const imgSrc =
    photo.medium_url || photo.thumb_url || photo.preview_url || "";
  const imgOk = imgSrc.includes("/derivatives/") && !imgSrc.match(/\/(thumbs|previews|mediums?)\//);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 flex items-center gap-4 px-6 py-3 backdrop-blur">
        <Link href="/admin/photos" className="text-sm text-gray-400 hover:text-white">← Library</Link>
        <span className="text-gray-700">/</span>
        <span className="text-sm font-mono text-gray-300">id={photo.id}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${photo.search_ready ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}>
            search={photo.search_ready ? "✓" : "✗"}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${photo.ready_for_public_render ? "bg-green-700 text-green-200" : "bg-gray-700 text-gray-400"}`}>
            render={photo.ready_for_public_render ? "✓" : "✗"}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${photo.ai_description_status === "accepted" ? "bg-green-600 text-white" : photo.ai_description_status ? "bg-gray-700 text-gray-400" : "bg-yellow-700 text-yellow-200"}`}>
            AI: {photo.ai_description_status || "none"}
          </span>
        </div>
      </div>

      <div className="flex gap-6 p-6">
        {/* Left: image + meta */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Preview */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            {imgOk ? (
              <img src={imgSrc} alt={photo.title || photo.slug} className="w-full object-cover" />
            ) : (
              <div className="aspect-[4/3] bg-gray-800 flex items-center justify-center text-5xl text-gray-700">◻</div>
            )}
          </div>

          {/* Status flags */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Status Flags</div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={searchReady} onChange={e => setSearchReady(e.target.checked)}
                disabled={!photo.derivatives_complete}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm text-gray-300">search_ready</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={readyForRender} onChange={e => setReadyForRender(e.target.checked)}
                disabled={!photo.derivatives_complete}
                className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500" />
              <span className="text-sm text-gray-300">ready_for_public_render</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={descriptionLocked} onChange={e => setDescriptionLocked(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500" />
              <span className="text-sm text-gray-300">description_locked</span>
            </label>
            {!photo.derivatives_complete && (
              <p className="text-xs text-red-400 mt-1">Flags disabled — derivatives incomplete</p>
            )}
          </div>

          {/* AI Info */}
          {photo.ai_description_status && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2 text-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">AI Description</div>
              <div className="grid grid-cols-2 gap-1 text-gray-400">
                <span>status:</span><span className="text-gray-200">{photo.ai_description_status}</span>
                <span>source:</span><span className="text-gray-200">{photo.ai_description_source || "—"}</span>
                <span>model:</span><span className="text-gray-200">{photo.ai_description_model || "—"}</span>
                <span>words:</span><span className="text-gray-200">{photo.ai_description_word_count ?? "—"}</span>
                <span>version:</span><span className="text-gray-200">{photo.ai_description_version || "—"}</span>
                <span>generated:</span><span className="text-gray-200">{photo.ai_description_generated_at ? new Date(photo.ai_description_generated_at).toLocaleString() : "—"}</span>
              </div>
              {photo.ai_description && (
                <div className="mt-2 rounded bg-gray-800 p-2 text-gray-300 text-[11px] leading-relaxed">
                  {photo.ai_description.slice(0, 300)}{photo.ai_description.length > 300 ? "…" : ""}
                </div>
              )}
            </div>
          )}

          {/* File info */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-1 text-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">File Info</div>
            <div className="text-gray-400">slug: <span className="text-gray-200 font-mono">{photo.slug}</span></div>
            <div className="text-gray-400">source: <span className="text-gray-200 font-mono break-all">{photo.source_path || "—"}</span></div>
            <div className="text-gray-400">r2_key: <span className="text-gray-200 font-mono break-all">{photo.original_r2_key || "—"}</span></div>
            <div className="text-gray-400">gallery: <span className="text-gray-200">{photo.gallery_name || "—"}</span></div>
            <div className="text-gray-400">date_taken: <span className="text-gray-200">{photo.date_taken || "—"}</span></div>
            <div className="text-gray-400">camera: <span className="text-gray-200">{photo.camera_model || "—"}</span></div>
            <div className="text-gray-400">lens: <span className="text-gray-200">{photo.lens_model || "—"}</span></div>
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="mb-4 flex gap-1 border-b border-gray-800">
            {(["edit", "history"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab ? "border-b-2 border-blue-500 text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab === "edit" ? "Edit Metadata" : "Edit History"}
              </button>
            ))}
          </div>

          {activeTab === "edit" ? (
            <div className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">{error}</div>
              )}
              {saved && (
                <div className="rounded-lg border border-green-800 bg-green-950/50 px-4 py-2 text-sm text-green-300">Saved ✓</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Title" value={title} onChange={setTitle} />
                </div>
                <div className="col-span-2">
                  <Field label="Description" value={description} onChange={setDescription} multiline rows={5} />
                </div>
                <div className="col-span-2">
                  <Field label="Keywords (comma-separated)" value={keywords} onChange={setKeywords} />
                </div>
                <Field label="Location" value={locationName} onChange={setLocationName} />
                <Field label="Region" value={region} onChange={setRegion} />
                <Field label="Country" value={country} onChange={setCountry} />
                <Field label="Gallery Slug" value={gallerySlug} onChange={setGallerySlug} />
                <Field label="Species (Common Name)" value={speciesCommon} onChange={setSpeciesCommon} />
                <Field label="Species (Scientific Name)" value={speciesScientific} onChange={setSpeciesScientific} />
                <div className="col-span-2">
                  <Field label="AI Review Notes" value={reviewNotes} onChange={setReviewNotes} multiline rows={2} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">AI Description Status</label>
                  <select
                    value={aiStatus}
                    onChange={e => setAiStatus(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">—</option>
                    <option value="generated">generated</option>
                    <option value="accepted">accepted</option>
                    <option value="rejected">rejected</option>
                    <option value="failed">failed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  onClick={fetchPhoto}
                  className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
                >
                  Discard
                </button>
                <a
                  href={`/photo/${photo.slug}`}
                  target="_blank"
                  className="ml-auto rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
                >
                  View on site →
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">No edit history yet.</p>
              ) : (
                history.map(h => (
                  <div key={h.id} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm">
                    <div className="shrink-0 text-xs text-gray-500 mt-0.5">
                      {new Date(h.edited_at).toLocaleString()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-blue-400">{h.field_changed}</span>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {h.old_value !== null && h.old_value !== "" && (
                          <><span className="text-red-400 line-through mr-1">"{h.old_value}"</span>→</>
                        )}
                        <span className="text-green-400">"{h.new_value}"</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
