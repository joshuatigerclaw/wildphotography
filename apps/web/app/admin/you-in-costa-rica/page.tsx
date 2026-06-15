"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Job = {
  id: string;
  status: string;
  userEmail: string | null;
  sessionId: string | null;
  sourcePhotoId: string | null;
  sourcePhotoSlug: string | null;
  sourceGallerySlug: string | null;
  sourceCdnUrl: string | null;
  uploadedUserR2Key: string | null;
  uploadedUserMime: string | null;
  uploadedUserSize: number | null;
  prompt: string | null;
  freeOutputR2Key: string | null;
  premiumOutputR2Key: string | null;
  watermarkApplied: boolean | null;
  stripeSessionId: string | null;
  stripePaymentStatus: string | null;
  stripeAmountCents: number | null;
  errorMessage: string | null;
  bundleJobIds: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  uploaded: number;
  processing: number;
  free_ready: number;
  payment_pending: number;
  premium_ready: number;
  failed: number;
  deleted: number;
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  free_ready: "Free Ready",
  payment_pending: "Payment Pending",
  premium_ready: "Premium Ready",
  failed: "Failed",
  deleted: "Deleted",
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-gray-700 text-gray-300",
  processing: "bg-blue-700 text-blue-200",
  free_ready: "bg-green-700 text-green-200",
  payment_pending: "bg-yellow-700 text-yellow-200",
  premium_ready: "bg-purple-700 text-purple-200",
  failed: "bg-red-700 text-red-200",
  deleted: "bg-gray-800 text-gray-500",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function Sidebar({ pathname }: { pathname: string }) {
  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: "◈" },
    { href: "/admin/photos", label: "Photo Library", icon: "◉" },
    { href: "/admin/quality", label: "Quality Queue", icon: "◆" },
    { href: "/admin/bulk", label: "Bulk Editor", icon: "▣" },
    { href: "/admin/you-in-costa-rica", label: "You in Costa Rica", icon: "◎" },
  ];
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-56 flex-col border-r border-gray-800 bg-gray-950 pt-4">
      <div className="mb-6 px-5">
        <Link href="/admin/dashboard" className="text-sm font-bold text-white hover:text-blue-400">
          WildPhotography
        </Link>
        <div className="text-xs text-gray-500">Admin</div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-800 px-3 py-4">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-900 hover:text-gray-400">
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}

function ImageThumb({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  if (!src) return <span className="text-gray-700 text-lg">—</span>;
  return (
    <img
      src={src}
      alt={alt}
      className={`rounded object-cover ${className}`}
      loading="lazy"
    />
  );
}

export default function YouInCostaRicaPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(24);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const totalPages = Math.ceil(total / perPage);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/you-in-costa-rica/admin/stats", { credentials: "include" });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchJobs = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pg),
        status: statusFilter,
        dateRange,
        search,
        limit: String(perPage),
      });
      const res = await fetch(`/api/you-in-costa-rica/admin/jobs?${params}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateRange, search, perPage]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchJobs(1); setPage(1); }, [fetchJobs]);

  function handlePage(newPage: number) {
    setPage(newPage);
    fetchJobs(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleAction(action: string, jobId: string) {
    setActionLoading(jobId + action);
    try {
      const res = await fetch(`/api/you-in-costa-rica/admin/job/${jobId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchJobs(page);
        fetchStats();
      }
    } finally {
      setActionLoading(null);
    }
  }

  const CDN = "https://images.wildphotography.com";

  function getFreeOutputUrl(job: Job): string | null {
    if (!job.freeOutputR2Key) return null;
    return `${CDN}/${job.freeOutputR2Key}`;
  }

  function getPremiumOutputUrl(job: Job): string | null {
    if (!job.premiumOutputR2Key) return null;
    return `${CDN}/${job.premiumOutputR2Key}`;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Sidebar pathname="/admin/you-in-costa-rica" />

      <div className="ml-56">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
          <div className="flex items-center gap-4 px-6 py-4">
            <span className="text-sm font-bold text-white">You in Costa Rica</span>
            <span className="text-gray-700">/</span>
            <span className="text-sm text-gray-400">Job Management</span>
            <div className="ml-auto flex items-center gap-3">
              {stats && (
                <span className="text-sm text-gray-500">{stats.total.toLocaleString()} total jobs</span>
              )}
            </div>
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="flex flex-wrap gap-2 px-6 pb-4">
              {[
                { label: "Total", value: stats.total, color: "text-white" },
                { label: "Uploaded", value: stats.uploaded, color: "text-gray-300" },
                { label: "Processing", value: stats.processing, color: "text-blue-300" },
                { label: "Free Ready", value: stats.free_ready, color: "text-green-300" },
                { label: "Payment Pending", value: stats.payment_pending, color: "text-yellow-300" },
                { label: "Premium Ready", value: stats.premium_ready, color: "text-purple-300" },
                { label: "Failed", value: stats.failed, color: "text-red-300" },
                { label: "Deleted", value: stats.deleted, color: "text-gray-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5">
                  <span className={`text-sm font-bold ${color}`}>{value.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); }}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="free_ready">Free Ready</option>
              <option value="payment_pending">Payment Pending</option>
              <option value="premium_ready">Premium Ready</option>
              <option value="failed">Failed</option>
              <option value="deleted">Deleted</option>
            </select>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Job ID or email…"
              className="flex-1 min-w-48 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <select
              value={perPage}
              onChange={e => { setPerPage(Number(e.target.value)); }}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value={12}>12 per page</option>
              <option value={24}>24 per page</option>
              <option value={48}>48 per page</option>
              <option value={96}>96 per page</option>
            </select>
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); setDateRange("30"); }}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
            >
              Clear
            </button>
          </div>
        </header>

        {/* Table */}
        <main className="p-6">
          {loading ? (
            <div className="flex h-60 items-center justify-center text-gray-500">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center text-gray-500">
              <span className="text-4xl">◎</span>
              <p className="mt-2 text-sm">No jobs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-3 py-3 font-medium">Created</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Source Photo</th>
                      <th className="px-3 py-3 font-medium">User Upload</th>
                      <th className="px-3 py-3 font-medium">Free Output</th>
                      <th className="px-3 py-3 font-medium">Premium Output</th>
                      <th className="px-3 py-3 font-medium">Email</th>
                      <th className="px-3 py-3 font-medium">Payment</th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <>
                        <tr
                          key={job.id}
                          onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                          className="cursor-pointer border-b border-gray-800 bg-gray-950 hover:bg-gray-900 transition-colors"
                        >
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-400">
                            <div title={formatDate(job.createdAt)}>{formatAge(job.createdAt)}</div>
                            <div className="mt-0.5 font-mono text-gray-600">{job.id.slice(0, 8)}…</div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status] || "bg-gray-700 text-gray-300"}`}>
                              {STATUS_LABELS[job.status] || job.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {job.sourceCdnUrl ? (
                              <div className="flex items-center gap-1">
                                <img src={job.sourceCdnUrl} alt="source" className="h-10 w-10 rounded object-cover" loading="lazy" />
                                {job.sourcePhotoSlug && (
                                  <a
                                    href={`/photos/${job.sourcePhotoSlug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-xs text-blue-400 hover:underline"
                                  >↗</a>
                                )}
                              </div>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {job.uploadedUserR2Key ? (
                              <div className="flex items-center gap-1">
                                <img
                                  src={`${CDN}/${job.uploadedUserR2Key}`}
                                  alt="user upload"
                                  className="h-10 w-10 rounded object-cover"
                                  loading="lazy"
                                />
                                {job.uploadedUserSize && (
                                  <span className="text-xs text-gray-600">{formatBytes(job.uploadedUserSize)}</span>
                                )}
                              </div>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {getFreeOutputUrl(job) ? (
                              <a href={getFreeOutputUrl(job)!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <img src={getFreeOutputUrl(job)!} alt="free output" className="h-10 w-10 rounded object-cover ring-1 ring-gray-700 hover:ring-blue-500" loading="lazy" />
                              </a>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {getPremiumOutputUrl(job) ? (
                              <a href={getPremiumOutputUrl(job)!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <img src={getPremiumOutputUrl(job)!} alt="premium output" className="h-10 w-10 rounded object-cover ring-1 ring-gray-700 hover:ring-purple-500" loading="lazy" />
                              </a>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-400 max-w-36 truncate">
                            {job.userEmail || <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs">
                            {job.stripePaymentStatus ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                job.stripePaymentStatus === "paid" ? "bg-green-900/60 text-green-300" :
                                job.stripePaymentStatus === "pending" ? "bg-yellow-900/60 text-yellow-300" :
                                "bg-red-900/60 text-red-300"
                              }`}>
                                {job.stripePaymentStatus}
                              </span>
                            ) : <span className="text-gray-700">—</span>}
                            {job.stripeAmountCents && (
                              <div className="mt-0.5 text-gray-600">${(job.stripeAmountCents / 100).toFixed(2)}</div>
                            )}
                          </td>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {job.sourceCdnUrl && (
                                <a
                                  href={job.sourceCdnUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
                                  title="View source"
                                >↗</a>
                              )}
                              {getPremiumOutputUrl(job) && (
                                <button
                                  onClick={() => navigator.clipboard.writeText(getPremiumOutputUrl(job)!)}
                                  className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
                                  title="Copy premium URL"
                                >📋</button>
                              )}
                              <button
                                onClick={() => handleAction("regenerate", job.id)}
                                disabled={actionLoading === job.id + "regenerate"}
                                className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-gray-800 disabled:opacity-40"
                                title="Regenerate"
                              >⟳</button>
                              {job.status !== "deleted" && (
                                <button
                                  onClick={() => handleAction("delete", job.id)}
                                  disabled={actionLoading === job.id + "delete"}
                                  className="rounded px-2 py-1 text-xs text-red-400 hover:bg-gray-800 disabled:opacity-40"
                                  title="Delete"
                                >✕</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === job.id && (
                          <tr key={`${job.id}-expanded`} className="border-b border-gray-800 bg-gray-900/50">
                            <td colSpan={9} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-6 text-xs">
                                <div className="space-y-3">
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Job ID</div>
                                    <div className="font-mono text-gray-300 break-all">{job.id}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Session ID</div>
                                    <div className="font-mono text-gray-300 break-all">{job.sessionId || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">User Email</div>
                                    <div className="text-gray-300">{job.userEmail || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Prompt</div>
                                    <div className="text-gray-300">{job.prompt || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Source Photo Slug</div>
                                    <div className="text-gray-300">{job.sourcePhotoSlug || "—"}</div>
                                    <div className="text-gray-300">{job.sourceGallerySlug || "—"}</div>
                                  </div>
                                  {job.sourceCdnUrl && (
                                    <div>
                                      <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Source CDN URL</div>
                                      <a href={job.sourceCdnUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{job.sourceCdnUrl}</a>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-3">
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Status</div>
                                    <div className="text-gray-300">{job.status}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Error Message</div>
                                    <div className="text-red-400">{job.errorMessage || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Stripe Session ID</div>
                                    <div className="font-mono text-gray-300">{job.stripeSessionId || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Stripe Amount</div>
                                    <div className="text-gray-300">{job.stripeAmountCents ? `$${(job.stripeAmountCents / 100).toFixed(2)}` : "—"}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Bundle Job IDs</div>
                                    <div className="font-mono text-gray-300 break-all">{job.bundleJobIds || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Watermark Applied</div>
                                    <div className="text-gray-300">{job.watermarkApplied === null ? "—" : job.watermarkApplied ? "Yes" : "No"}</div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Created At</div>
                                      <div className="text-gray-300">{formatDate(job.createdAt)}</div>
                                    </div>
                                    <div>
                                      <div className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Updated At</div>
                                      <div className="text-gray-300">{formatDate(job.updatedAt)}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <button
                    onClick={() => handlePage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-30"
                  >
                    ← Prev
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      Page {page} / {totalPages} — {total.toLocaleString()} total
                    </span>
                    {totalPages > 10 && (
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={page}
                        onChange={e => {
                          const p = Math.max(1, Math.min(totalPages, Number(e.target.value)));
                          if (p !== page) handlePage(p);
                        }}
                        className="w-16 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => handlePage(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}