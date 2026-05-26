"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type BacklinkOpportunity = {
  id: number;
  source_domain: string;
  page_url: string;
  page_title: string;
  credit_found: boolean;
  backlink_found: boolean;
  contact_email: string | null;
  outreach_status: string;
  first_seen_at: string;
  last_checked_at: string;
  notes: string | null;
};

function BacklinkContent() {
  const searchParams = useSearchParams();
  const adminToken = searchParams.get("token") || "";

  const [items, setItems] = useState<BacklinkOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [verified, setVerified] = useState(false);

  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

  useEffect(() => {
    if (!adminToken && ADMIN_PASSWORD) {
      // Token-based auth
    } else if (!adminToken && !ADMIN_PASSWORD) {
      setVerified(true); // no password configured
    } else {
      // Verify token
      if (adminToken === ADMIN_PASSWORD) {
        setVerified(true);
      } else {
        setError("Invalid access token");
        setLoading(false);
      }
    }
  }, [adminToken, ADMIN_PASSWORD]);

  useEffect(() => {
    if (!verified) return;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (filterDomain) params.set("domain", filterDomain);
        if (filterStatus) params.set("status", filterStatus);

        const res = await fetch(`/api/admin/backlink-opportunities?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setItems(data.items || []);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [verified, filterDomain, filterStatus]);

  if (!verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
        <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <div className="mb-2 text-2xl font-bold tracking-tight">Backlink Opportunities</div>
            <div className="text-sm font-medium text-gray-400">Admin Access</div>
          </div>
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <p className="text-xs text-gray-500 text-center">
            Provide <code className="bg-gray-800 px-1 py-0.5 rounded">?token=PASSWORD</code> in the URL to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">← Admin</Link>
          <h1 className="text-lg font-semibold text-white">Backlink Opportunities</h1>
          <p className="text-xs text-gray-400">{items.length} record{items.length !== 1 ? "s" : ""} found</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter by domain…"
            value={filterDomain}
            onChange={e => setFilterDomain(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="contacted">Contacted</option>
            <option value="secured">Secured</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-gray-500 text-sm">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center text-gray-500 text-sm">
          No backlink opportunities found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Article Title</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3 text-center">Credit</th>
                <th className="px-4 py-3 text-center">Backlink</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Last Checked</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium text-gray-200 whitespace-nowrap">
                    {item.source_domain}
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={item.page_title}>
                    {item.page_title}
                  </td>
                  <td className="px-4 py-3">
                    {item.page_url ? (
                      <a
                        href={item.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs underline"
                      >
                        ↗ View
                      </a>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.credit_found ? (
                      <span className="inline-block rounded bg-green-600/20 px-1.5 py-0.5 text-[10px] font-bold text-green-400">YES</span>
                    ) : (
                      <span className="inline-block rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">NO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.backlink_found ? (
                      <span className="inline-block rounded bg-green-600/20 px-1.5 py-0.5 text-[10px] font-bold text-green-400">YES</span>
                    ) : (
                      <span className="inline-block rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">NO</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                      item.outreach_status === 'secured' ? 'bg-green-600/20 text-green-400' :
                      item.outreach_status === 'contacted' ? 'bg-blue-600/20 text-blue-400' :
                      item.outreach_status === 'rejected' ? 'bg-red-600/20 text-red-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {item.outreach_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {item.contact_email || <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(item.last_checked_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[150px] truncate" title={item.notes || ''}>
                    {item.notes || <span className="text-gray-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BacklinkOpportunitiesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-500">Loading…</div>}>
      <BacklinkContent />
    </Suspense>
  );
}