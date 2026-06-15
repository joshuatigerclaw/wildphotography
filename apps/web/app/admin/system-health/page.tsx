"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type HealthData = {
  generated_at: string;
  neon_api_auth: {
    source: string;
    healthy: boolean;
    latency_ms: number;
    active_keys: number | null;
    active_customers: number | null;
    active_plans: number | null;
    error: string | null;
  };
  visit_tracking: {
    mode: string;
    visits_today: number | null;
    visits_7d: number | null;
    last_rollup: string | null;
    error: string | null;
  };
  typesense_safeguards: {
    full_export_guard_active: boolean;
    guard_python: boolean;
    guard_js: boolean;
    active_reconcile_cron: string;
    old_reconcile_cron_disabled: boolean;
    last_drift_count: number | null;
    last_reconcile_runtime_seconds: number | null;
    last_reconcile_run: string | null;
    latest_log_file: string | null;
  };
  warnings: string[];
};

function Sidebar({ pathname }: { pathname: string }) {
  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: "◈" },
    { href: "/admin/photos", label: "Photo Library", icon: "◉" },
    { href: "/admin/quality", label: "Quality Queue", icon: "◆" },
    { href: "/admin/bulk", label: "Bulk Editor", icon: "▣" },
    { href: "/admin/system-health", label: "System Health", icon: "◉" },
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
              pathname === item.href || (item.href !== "/admin/system-health" && pathname.startsWith(item.href + "/"))
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

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      ok ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
    }`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, badge }: { label: string; value: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-800/50 py-2.5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {badge}
        <span className="text-sm font-medium text-white">{value}</span>
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/system-health", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(null);
      } else {
        setError(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar pathname={pathname} />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">System Health — Cost Optimization</h1>
          <button
            onClick={fetchHealth}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-600 hover:text-gray-200"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center text-gray-500">Loading…</div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-red-400">Error: {error}</div>
        ) : data ? (
          <>
            {/* Warnings */}
            {data.warnings.length > 0 && (
              <div className="mb-6 rounded-xl border border-orange-800/60 bg-orange-950/30 p-4">
                <div className="mb-2 text-sm font-semibold text-orange-400">⚠ Warnings</div>
                <ul className="space-y-1">
                  {data.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-orange-300">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.warnings.length === 0 && (
              <div className="mb-6 rounded-xl border border-green-900/40 bg-green-950/20 p-4">
                <span className="text-sm font-medium text-green-400">✓ All systems nominal — no warnings</span>
              </div>
            )}

            <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <span className="text-xs text-gray-500">
                Last generated: {new Date(data.generated_at).toLocaleString()} &nbsp;·&nbsp;
                Source: {pathname}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

              {/* ── Neon API Auth ── */}
              <SectionCard title="1 · Neon API Auth">
                <div className="space-y-0">
                  <Row
                    label="Auth source"
                    value={<span className="text-blue-400">{data.neon_api_auth.source.toUpperCase()}</span>}
                    badge={<StatusBadge ok={data.neon_api_auth.healthy} label={data.neon_api_auth.healthy ? "OK" : "ERROR"} />}
                  />
                  <Row
                    label="Query latency"
                    value={
                      <span className={data.neon_api_auth.latency_ms > 3000 ? "text-orange-400" : "text-white"}>
                        {data.neon_api_auth.latency_ms}ms
                      </span>
                    }
                  />
                  <Row label="Active API keys" value={data.neon_api_auth.active_keys?.toLocaleString() ?? "—"} />
                  <Row label="Active customers" value={data.neon_api_auth.active_customers?.toLocaleString() ?? "—"} />
                  <Row label="Active plans" value={data.neon_api_auth.active_plans?.toLocaleString() ?? "—"} />
                  {data.neon_api_auth.error && (
                    <div className="mt-2 rounded bg-red-950/40 p-2 text-xs text-red-400">
                      Error: {data.neon_api_auth.error}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* ── Visit Tracking ── */}
              <SectionCard title="2 · Visit Tracking">
                <div className="space-y-0">
                  <Row
                    label="Tracking mode"
                    value={<span className="text-purple-400">{data.visit_tracking.mode}</span>}
                  />
                  <Row
                    label="Visits today"
                    value={data.visit_tracking.visits_today?.toLocaleString() ?? "—"}
                  />
                  <Row
                    label="Visits (7 days)"
                    value={data.visit_tracking.visits_7d?.toLocaleString() ?? "—"}
                  />
                  <Row
                    label="Last rollup"
                    value={
                      data.visit_tracking.last_rollup
                        ? new Date(data.visit_tracking.last_rollup).toLocaleString()
                        : "—"
                    }
                  />
                  {data.visit_tracking.error && (
                    <div className="mt-2 rounded bg-red-950/40 p-2 text-xs text-red-400">
                      Error: {data.visit_tracking.error}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* ── Typesense Safeguards ── */}
              <SectionCard title="3 · Typesense Bandwidth Safeguards">
                <div className="space-y-0">
                  <Row
                    label="Full export guard"
                    badge={
                      <StatusBadge
                        ok={data.typesense_safeguards.full_export_guard_active}
                        label={data.typesense_safeguards.full_export_guard_active ? "ACTIVE" : "MISSING"}
                      />
                    }
                    value={
                      data.typesense_safeguards.full_export_guard_active
                        ? "Python + JS"
                        : "Check scripts"
                    }
                  />
                  <Row
                    label="Python guard"
                    value={data.typesense_safeguards.guard_python ? "✓ present" : "✗ missing"}
                  />
                  <Row
                    label="JS guard (v23)"
                    value={data.typesense_safeguards.guard_js ? "✓ present" : "✗ missing"}
                  />
                  <Row
                    label="Active reconcile cron"
                    value={
                      <span className="text-green-400">
                        {data.typesense_safeguards.active_reconcile_cron}
                      </span>
                    }
                  />
                  <Row
                    label="Old reconcile cron disabled"
                    badge={
                      <StatusBadge
                        ok={data.typesense_safeguards.old_reconcile_cron_disabled}
                        label={data.typesense_safeguards.old_reconcile_cron_disabled ? "YES" : "NO"}
                      />
                    }
                    value={
                      data.typesense_safeguards.old_reconcile_cron_disabled
                        ? "12-hour cron disabled"
                        : "Still running — check cron settings"
                    }
                  />
                  <Row
                    label="Last drift count"
                    value={
                      <span className={
                        data.typesense_safeguards.last_drift_count === null
                          ? "text-gray-500"
                          : data.typesense_safeguards.last_drift_count > 1000
                          ? "text-orange-400"
                          : "text-green-400"
                      }>
                        {data.typesense_safeguards.last_drift_count ?? "—"}
                      </span>
                    }
                  />
                  <Row
                    label="Last reconcile runtime"
                    value={
                      data.typesense_safeguards.last_reconcile_runtime_seconds
                        ? `${data.typesense_safeguards.last_reconcile_runtime_seconds}s`
                        : "—"
                    }
                  />
                  <Row
                    label="Last reconcile run"
                    value={
                      data.typesense_safeguards.last_reconcile_run
                        ? new Date(data.typesense_safeguards.last_reconcile_run).toLocaleString()
                        : "—"
                    }
                  />
                  {data.typesense_safeguards.latest_log_file && (
                    <Row
                      label="Log file"
                      value={<span className="text-xs text-gray-500">{data.typesense_safeguards.latest_log_file}</span>}
                    />
                  )}
                </div>
              </SectionCard>

              {/* ── Cost Impact ── */}
              <SectionCard title="4 · Estimated Bandwidth Reduction">
                <div className="space-y-3">
                  <div className="rounded-lg border border-green-900/40 bg-green-950/20 p-3">
                    <div className="text-2xl font-bold text-green-400">~98%</div>
                    <div className="text-xs text-green-300/70">reduction vs. before the fix</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                      <div className="text-lg font-bold text-white">
                        {data.typesense_safeguards.last_drift_count !== null && data.typesense_safeguards.last_drift_count < 1000
                          ? "✓ Healthy"
                          : data.typesense_safeguards.last_drift_count !== null
                          ? "⚠ High"
                          : "?"}
                      </div>
                      <div className="text-xs text-gray-500">TS drift</div>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                      <div className="text-lg font-bold text-white">~2 GB</div>
                      <div className="text-xs text-gray-500">Est. monthly (was ~87 GB)</div>
                    </div>
                  </div>
                </div>
              </SectionCard>

            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
