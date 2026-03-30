"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

type Stats = {
  total_photos: number;
  ready_for_public_render: number;
  search_ready: number;
  derivatives_complete: number;
  ai_descriptions_generated: number;
  ai_descriptions_accepted: number;
  ai_descriptions_failed: number;
  quality_issues: number;
};

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="text-3xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="mt-1 text-sm font-medium text-gray-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: "◈" },
    { href: "/admin/photos", label: "Photo Library", icon: "◉" },
    { href: "/admin/quality", label: "Quality Queue", icon: "◆" },
    { href: "/admin/bulk", label: "Bulk Editor", icon: "▣" },
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
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-900 hover:text-gray-400"
        >
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const pct = (n: number, d: number) => d ? `${((n/d)*100).toFixed(1)}%` : "—";

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar pathname={pathname} />
      <main className="ml-56 flex-1 p-8">
        <h1 className="mb-6 text-2xl font-bold text-white">Dashboard</h1>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-gray-500">Loading…</div>
        ) : stats ? (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Total Photos" value={stats.total_photos} />
              <StatCard
                label="Ready to Render"
                value={stats.ready_for_public_render}
                sub={pct(stats.ready_for_public_render, stats.total_photos)}
              />
              <StatCard
                label="Search Indexed"
                value={stats.search_ready}
                sub={pct(stats.search_ready, stats.total_photos)}
              />
              <StatCard
                label="Derivatives Complete"
                value={stats.derivatives_complete}
                sub={pct(stats.derivatives_complete, stats.total_photos)}
              />
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard
                label="AI Descriptions Generated"
                value={stats.ai_descriptions_generated}
              />
              <StatCard
                label="AI Descriptions Accepted"
                value={stats.ai_descriptions_accepted}
              />
              <StatCard
                label="AI Descriptions Failed"
                value={stats.ai_descriptions_failed}
              />
              <Link href="/admin/quality">
                <div className="rounded-xl border border-orange-900/50 bg-orange-950/20 p-5 hover:border-orange-700">
                  <div className="text-3xl font-bold text-orange-400">{stats.quality_issues}</div>
                  <div className="mt-1 text-sm font-medium text-orange-300">Quality Issues</div>
                  <div className="mt-0.5 text-xs text-orange-700">Review and fix →</div>
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              <Link
                href="/admin/photos?filterReady=false"
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700"
              >
                <div className="text-2xl font-bold text-yellow-400">
                  {(stats.total_photos - stats.ready_for_public_render).toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-gray-400">Not render-ready</div>
              </Link>
              <Link
                href="/admin/photos?filterSearchReady=false&filterReady=true"
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700"
              >
                <div className="text-2xl font-bold text-purple-400">
                  {(stats.ready_for_public_render - stats.search_ready).toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-gray-400">Rendered but not indexed</div>
              </Link>
              <Link
                href="/admin/quality"
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700"
              >
                <div className="text-2xl font-bold text-red-400">
                  {stats.ai_descriptions_failed.toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-gray-400">Failed AI descriptions</div>
              </Link>
            </div>
          </>
        ) : (
          <div className="flex h-40 items-center justify-center text-red-400">
            Failed to load stats — are you logged in?
          </div>
        )}
      </main>
    </div>
  );
}
