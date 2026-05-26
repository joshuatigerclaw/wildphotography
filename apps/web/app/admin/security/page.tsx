"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SecuritySummary = {
  total_requests: number;
  suspicious_requests: number;
  blocked_challenged: number;
  avg_bot_score: number;
  max_bot_score: number;
  api_v1_requests: number;
  top_country: string | null;
  top_asn: string | null;
  top_endpoint: string | null;
};

type EndpointTraffic = {
  endpoint_group: string;
  request_count: number;
  blocked_count: number;
  downgraded_count: number;
  avg_bot_score: number;
  top_country: string | null;
  top_asn: string | null;
};

type SuspiciousUA = {
  user_agent: string;
  user_agent_hash: string;
  count: number;
  last_seen: string;
  action_taken: string;
  reasons: string | null;
};

type CountryASN = {
  country: string;
  asn: string;
  request_count: number;
  avg_bot_score: number;
  suspicious_count: number;
  top_endpoint: string | null;
};

type IPAbuse = {
  ip_hash: string;
  user_agent_hash: string;
  endpoint_group: string;
  request_count: number;
  latest_request: string;
  action_taken: string;
  reasons: string | null;
  avg_bot_score: number;
};

type AlertCandidate = {
  ip_hash: string;
  user_agent_hash: string;
  endpoint_group: string;
  request_count: number;
  latest_request: string;
  avg_bot_score: number;
  reasons: string | null;
};

type RecentEvent = {
  created_at: string;
  request_path: string;
  country: string | null;
  asn: string | null;
  user_agent: string | null;
  bot_score: number | null;
  action_taken: string;
  reason: string | null;
  status_code: number;
  response_time_ms: number | null;
};

type SecurityData = {
  summary: SecuritySummary;
  trafficByEndpoint: EndpointTraffic[];
  suspiciousUA: SuspiciousUA[];
  countryASN: CountryASN[];
  ipAbuse: IPAbuse[];
  alertCandidates: AlertCandidate[];
  recentEvents: RecentEvent[];
  filters: {
    period: string;
    endpointGroup: string;
    country: string;
    asn: string;
    actionTaken: string;
    minBotScore: string;
    dateFrom: string;
    dateTo: string;
  };
};

function StatCard({ label, value, sub, color = "white" }: { label: string; value: number | string; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    white: "text-white",
    orange: "text-orange-400",
    red: "text-red-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
  };
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className={`text-3xl font-bold ${colorMap[color] || colorMap.white}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>;
}

function DataTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="py-4 text-center text-sm text-gray-600">No data for this period.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map(col => (
              <th key={col} className="pb-2 text-left font-medium text-gray-400">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              {Object.values(row).map((val, j) => (
                <td key={j} className="py-2 pr-4 text-gray-300">
                  {val === null || val === undefined ? <span className="text-gray-600">—</span> : String(val)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: "◈" },
    { href: "/admin/photos", label: "Photo Library", icon: "◉" },
    { href: "/admin/quality", label: "Quality Queue", icon: "◆" },
    { href: "/admin/bulk", label: "Bulk Editor", icon: "▣" },
    { href: "/admin/security", label: "Security", icon: "⛨" },
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
        <Link
          href="/admin/security/cloudflare-rules"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-900 hover:text-gray-300"
        >
          <span className="text-base">☁</span>
          CF Rules
        </Link>
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

export default function AdminSecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // Filters
  const [period, setPeriod] = useState("today");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [asnFilter, setAsnFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('period', period);
      if (endpointFilter) params.set('endpoint_group', endpointFilter);
      if (countryFilter) params.set('country', countryFilter);
      if (asnFilter) params.set('asn', asnFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/admin/security?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) { setError("Unauthorized — please log in."); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load security data");
    } finally {
      setLoading(false);
    }
  }, [period, endpointFilter, countryFilter, asnFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = data?.summary;

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar pathname={pathname} />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Phase 5 — API request logging &amp; threat monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <button
              onClick={fetchData}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Refresh
            </button>
            <Link
              href="/admin/security/cloudflare-rules"
              className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-900"
            >
              Cloudflare Rules →
            </Link>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Endpoint</label>
            <input
              value={endpointFilter}
              onChange={e => setEndpointFilter(e.target.value)}
              placeholder="e.g. search, map"
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Country</label>
            <input
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              placeholder="e.g. SG"
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">ASN</label>
            <input
              value={asnFilter}
              onChange={e => setAsnFilter(e.target.value)}
              placeholder="e.g. AS138994"
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Action</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
            >
              <option value="">All</option>
              <option value="blocked">Blocked</option>
              <option value="challenge">Challenge</option>
              <option value="downgraded">Downgraded</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center text-gray-500">Loading security data…</div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-red-400">{error}</div>
        ) : data ? (
          <>
            {/* ── Summary Cards ── */}
            <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Total Logged Requests" value={summary?.total_requests?.toLocaleString() ?? 0} color="white" />
              <StatCard label="Suspicious Requests" value={summary?.suspicious_requests?.toLocaleString() ?? 0} color="orange" sub="blocked / challenged / downgraded" />
              <StatCard label="Blocked / Challenged" value={summary?.blocked_challenged?.toLocaleString() ?? 0} color="red" />
              <StatCard label="Avg Bot Score" value={summary?.avg_bot_score ?? 0} color="yellow" sub={`max: ${summary?.max_bot_score ?? 0}`} />
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Top Country" value={summary?.top_country ?? '—'} color="blue" />
              <StatCard label="Top ASN" value={summary?.top_asn ?? '—'} color="blue" />
              <StatCard label="Top Endpoint" value={summary?.top_endpoint ?? '—'} color="blue" />
              <StatCard label="API v1 Requests" value={summary?.api_v1_requests?.toLocaleString() ?? 0} color="white" sub="in period" />
            </div>

            {/* ── Alert Candidates ── */}
            {data.alertCandidates && data.alertCandidates.length > 0 && (
              <div className="mb-8">
                <SectionHeader title="🚨 Alert Candidates — High Volume Blocked Requests" />
                <div className="overflow-x-auto rounded-xl border border-red-900/30 bg-red-950/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="pb-2 text-left text-gray-400">IP Hash</th>
                        <th className="pb-2 text-left text-gray-400">UA Hash</th>
                        <th className="pb-2 text-left text-gray-400">Endpoint</th>
                        <th className="pb-2 text-left text-gray-400">Count</th>
                        <th className="pb-2 text-left text-gray-400">Avg Bot Score</th>
                        <th className="pb-2 text-left text-gray-400">Latest</th>
                        <th className="pb-2 text-left text-gray-400">Reasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.alertCandidates.map((row, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="py-2 pr-4 font-mono text-red-400">{row.ip_hash}</td>
                          <td className="py-2 pr-4 font-mono text-gray-400">{row.user_agent_hash}</td>
                          <td className="py-2 pr-4 text-gray-300">{row.endpoint_group}</td>
                          <td className="py-2 pr-4 text-red-400">{row.request_count}</td>
                          <td className="py-2 pr-4 text-yellow-400">{row.avg_bot_score}</td>
                          <td className="py-2 pr-4 text-gray-500">{row.latest_request}</td>
                          <td className="py-2 pr-4 text-gray-400">{row.reasons}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Traffic by Endpoint ── */}
            <div className="mb-8">
              <SectionHeader title="Traffic by Endpoint Group" />
              <div className="rounded-xl border border-gray-800 bg-gray-900/50">
                <DataTable
                  columns={["Endpoint Group", "Requests", "Blocked", "Downgraded", "Avg Bot Score", "Top Country", "Top ASN"]}
                  rows={data.trafficByEndpoint.map(r => ({
                    "Endpoint Group": r.endpoint_group,
                    "Requests": r.request_count.toLocaleString(),
                    "Blocked": r.blocked_count.toLocaleString(),
                    "Downgraded": r.downgraded_count.toLocaleString(),
                    "Avg Bot Score": r.avg_bot_score,
                    "Top Country": r.top_country ?? '—',
                    "Top ASN": r.top_asn ?? '—',
                  }))}
                />
              </div>
            </div>

            {/* ── Suspicious User Agents ── */}
            <div className="mb-8">
              <SectionHeader title="Suspicious User Agents" />
              <div className="rounded-xl border border-gray-800 bg-gray-900/50">
                <DataTable
                  columns={["User Agent", "Count", "Last Seen", "Action", "Reasons"]}
                  rows={data.suspiciousUA.map(r => ({
                    "User Agent": r.user_agent?.slice(0, 80) + (r.user_agent && r.user_agent.length > 80 ? '…' : ''),
                    "Count": r.count.toLocaleString(),
                    "Last Seen": r.last_seen,
                    "Action": r.action_taken,
                    "Reasons": r.reasons,
                  }))}
                />
              </div>
            </div>

            {/* ── Country / ASN Patterns ── */}
            <div className="mb-8">
              <SectionHeader title="Country / ASN Patterns" />
              <div className="rounded-xl border border-gray-800 bg-gray-900/50">
                <DataTable
                  columns={["Country", "ASN", "Requests", "Avg Bot Score", "Suspicious Count", "Top Endpoint"]}
                  rows={data.countryASN.map(r => ({
                    "Country": r.country,
                    "ASN": r.asn,
                    "Requests": r.request_count.toLocaleString(),
                    "Avg Bot Score": r.avg_bot_score,
                    "Suspicious Count": r.suspicious_count,
                    "Top Endpoint": r.top_endpoint ?? '—',
                  }))}
                />
              </div>
            </div>

            {/* ── Recent Security Events ── */}
            <div className="mb-8">
              <SectionHeader title="Recent Security Events (blocked / challenge / error)" />
              <div className="rounded-xl border border-gray-800 bg-gray-900/50">
                <DataTable
                  columns={["Time", "Path", "Country", "ASN", "Bot Score", "Action", "Reason", "Status"]}
                  rows={data.recentEvents.map(r => ({
                    "Time": r.created_at?.slice(0, 19).replace('T', ' '),
                    "Path": r.request_path,
                    "Country": r.country ?? '—',
                    "ASN": r.asn ?? '—',
                    "Bot Score": r.bot_score ?? '—',
                    "Action": r.action_taken,
                    "Reason": r.reason ?? '—',
                    "Status": r.status_code,
                  }))}
                />
              </div>
            </div>

            {/* ── IP Abuse Candidates ── */}
            {data.ipAbuse && data.ipAbuse.length > 0 && (
              <div className="mb-8">
                <SectionHeader title="IP Hash Abuse Candidates" />
                <div className="rounded-xl border border-orange-900/30 bg-orange-950/10">
                  <DataTable
                    columns={["IP Hash", "UA Hash", "Endpoint", "Count", "Avg Bot Score", "Latest Request", "Action", "Reasons"]}
                    rows={data.ipAbuse.map(r => ({
                      "IP Hash": r.ip_hash,
                      "UA Hash": r.user_agent_hash,
                      "Endpoint": r.endpoint_group,
                      "Count": r.request_count,
                      "Avg Bot Score": r.avg_bot_score,
                      "Latest Request": r.latest_request?.slice(0, 19).replace('T', ' '),
                      "Action": r.action_taken,
                      "Reasons": r.reasons,
                    }))}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-blue-900/30 bg-blue-950/20 p-4">
              <p className="text-xs text-blue-300">
                <strong>Privacy note:</strong> Raw IP addresses are never stored. IPs are hashed server-side with a per-deployment salt before logging. 
                User agents are stored as-is for threat detection. Authorization headers and API keys are never logged.
              </p>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}