'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Customer = {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  plan_id: string;
  plan_name: string;
  monthly_call_limit: number;
  status: string;
  key_prefix: string | null;
  key_status: string | null;
  last_used_at: string | null;
  calls_used: number | null;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  explorer: 'Explorer Developer',
  professional: 'Professional Tourism',
  enterprise: 'AI & Enterprise Vision',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-900/30 text-green-400 border-green-700',
  inactive: 'bg-gray-900/30 text-gray-400 border-gray-700',
  suspended: 'bg-red-900/30 text-red-400 border-red-700',
};

function Sidebar({ pathname }: { pathname: string }) {
  const nav = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '◈' },
    { href: '/admin/photos', label: 'Photo Library', icon: '◉' },
    { href: '/admin/quality', label: 'Quality Queue', icon: '◆' },
    { href: '/admin/bulk', label: 'Bulk Editor', icon: '▣' },
    { href: '/admin/api-leads', label: 'API Leads', icon: '⬡' },
    { href: '/admin/api-customers', label: 'API Customers', icon: '◈', highlight: true },
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
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === item.href
                ? 'bg-blue-900/30 text-blue-400 font-medium border border-blue-800'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200' +
                  (item.highlight ? ' text-blue-300' : '')
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

export default function ApiCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/api-customers', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      } else {
        setError(`Failed to load: ${res.status}`);
      }
    } catch (e) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  async function handleRevokeKey(customerId: number) {
    if (!confirm('Revoke this customer\'s active API key? They will lose API access until a new key is generated.')) return;
    setActionLoading(customerId);
    try {
      const res = await fetch(`/api/admin/api-customers/${customerId}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, key_prefix: null, key_status: 'revoked' } : c));
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeactivate(customerId: number) {
    if (!confirm('Deactivate this customer account? Their API key will be immediately revoked.')) return;
    setActionLoading(customerId);
    try {
      const res = await fetch(`/api/admin/api-customers/${customerId}/deactivate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, status: 'inactive' } : c));
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Sidebar pathname={pathname} />
      <div className="pl-56">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">API Customers</h1>
              <p className="text-sm text-gray-500 mt-1">Manage onboarded customers, keys, and usage</p>
            </div>
            <button onClick={fetchCustomers} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700">
              ↻ Refresh
            </button>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-900 rounded-xl animate-pulse" />)}
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16 text-gray-600">No customers yet. Onboard someone from API Leads.</div>
          ) : (
            <div className="space-y-4">
              {customers.map(customer => (
                <div key={customer.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-white font-semibold text-lg">{customer.name || 'Unnamed'}</div>
                      <div className="text-gray-400 text-sm">{customer.email}</div>
                      {customer.company && <div className="text-gray-500 text-sm mt-0.5">{customer.company}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[customer.status] || STATUS_COLORS.inactive}`}>
                        {customer.status}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs bg-blue-900/30 text-blue-400 border border-blue-800`}>
                        {PLAN_LABELS[customer.plan_id] || customer.plan_name}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Plan limit</div>
                      <div className="text-white">{customer.monthly_call_limit}/mo</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Used this month</div>
                      <div className="text-white">{customer.calls_used ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">API key</div>
                      <div className="text-white font-mono text-xs">
                        {customer.key_prefix ? `${customer.key_prefix}••••••••••` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Last used</div>
                      <div className="text-white text-xs">{formatDate(customer.last_used_at)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <div className="text-xs text-gray-600">Customer since {formatDate(customer.created_at)}</div>
                    <div className="flex gap-2">
                      {customer.key_status === 'active' && (
                        <button
                          onClick={() => handleRevokeKey(customer.id)}
                          disabled={actionLoading === customer.id}
                          className="px-4 py-2 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === customer.id ? 'Revoking…' : '✕ Revoke Key'}
                        </button>
                      )}
                      {customer.status === 'active' && (
                        <button
                          onClick={() => handleDeactivate(customer.id)}
                          disabled={actionLoading === customer.id}
                          className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
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
