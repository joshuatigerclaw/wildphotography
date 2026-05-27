'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const PLAN_LABELS: Record<string, string> = {
  explorer: 'Explorer Developer',
  professional: 'Professional Tourism',
  enterprise: 'AI & Enterprise Vision',
};

const PLAN_FEATURES: Record<string, string[]> = {
  explorer: ['thumb + small images', '250 calls/month', 'Attribution required'],
  professional: ['thumb + small + medium images', '750 calls/month', 'No attribution'],
  enterprise: ['thumb + small + medium + large images', '2,000 calls/month', 'AI/agentic use allowed'],
};

type CustomerData = {
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

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct > 90 ? 'bg-red-600' : pct > 70 ? 'bg-yellow-600' : 'bg-blue-600';
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{used.toLocaleString()} used</span>
        <span>{limit.toLocaleString()} limit</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AccountApiPage() {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loadingKey, setLoadingKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [usageLoading, setUsageLoading] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleLookupByKey() {
    if (!apiKeyInput.trim()) return;
    setLoadingKey(true);
    setKeyError('');
    try {
      const res = await fetch('/api/account/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKeyInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
      } else {
        const err = await res.json();
        setKeyError(err.error || 'Invalid key');
      }
    } catch {
      setKeyError('Connection error');
    } finally {
      setLoadingKey(false);
    }
  }

  async function testApiCall() {
    if (!customer) return;
    setSampleError('');
    setTestResult(null);
    setUsageLoading(true);
    try {
      const res = await fetch(
        `https://www.wildphotography.com/api/v1/usage`,
        {
          headers: { Authorization: `Bearer ${apiKeyInput}` },
        }
      );
      const data = await res.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setSampleError('Request failed. Check browser console.');
    } finally {
      setLoadingKey(false);
    }
  }

  const remaining = customer ? Math.max(0, customer.monthly_call_limit - (customer.calls_used || 0)) : 0;
  const resetDate = (() => {
    const d = new Date();
    return new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 1).toLocaleDateString();
  })();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top nav */}
      <div className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-lg hover:text-blue-400">WildPhotography</Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-yellow-500 bg-yellow-900/30 border border-yellow-800 px-3 py-1 rounded-full">
              Customer API Dashboard Preview
            </span>
            <Link href="/developers/api" className="text-sm text-gray-500 hover:text-blue-400">Docs →</Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {!customer ? (
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white mb-3">API Dashboard</h1>
            <p className="text-gray-400 mb-10">
              Enter your API key to view your usage, plan details, and documentation links.
            </p>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md mx-auto">
              <label className="block text-sm text-gray-400 mb-2 text-left">Your API Key</label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="wpa_your_api_key_here"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono mb-4 placeholder-gray-600 focus:border-blue-600 focus:outline-none"
              />
              {keyError && <div className="mb-4 text-sm text-red-400">{keyError}</div>}
              <button
                onClick={handleLookupByKey}
                disabled={loadingKey || !apiKeyInput.trim()}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {loadingKey ? 'Looking up…' : 'View My Dashboard'}
              </button>
              <div className="mt-6 pt-6 border-t border-gray-800 text-left">
                <p className="text-xs text-gray-500">
                  No key yet?{' '}
                  <Link href="/api-access" className="text-blue-400 hover:text-blue-300">
                    Apply for API access →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-1">
                {customer.name || 'Your API Account'}
              </h1>
              <p className="text-gray-400">{customer.email}</p>
            </div>

            {/* Key & identity */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-white font-semibold text-lg mb-1">Account Details</h2>
                  <div className="text-gray-400 text-sm">
                    {PLAN_LABELS[customer.plan_id] || customer.plan_name}
                  </div>
                </div>
                <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800 px-3 py-1 rounded-full">
                  {customer.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Key prefix</div>
                  <div className="text-white font-mono text-sm">
                    {customer.key_prefix ? `${customer.key_prefix}••••••••` : '— No active key'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Customer since</div>
                  <div className="text-white text-sm">{formatDate(customer.created_at)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Company</div>
                  <div className="text-white text-sm">{customer.company || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Last used</div>
                  <div className="text-white text-sm">{formatDate(customer.last_used_at)}</div>
                </div>
              </div>
            </div>

            {/* Usage */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Monthly Usage</h2>
              <ProgressBar used={customer.calls_used || 0} limit={customer.monthly_call_limit} />
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Used</div>
                  <div className="text-white text-base font-semibold">{(customer.calls_used || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Remaining</div>
                  <div className="text-white text-base font-semibold">{remaining.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Resets</div>
                  <div className="text-white text-sm">{resetDate}</div>
                </div>
              </div>
            </div>

            {/* Plan features */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Your Plan — {PLAN_LABELS[customer.plan_id]}</h2>
              <div className="grid grid-cols-1 gap-2">
                {(PLAN_FEATURES[customer.plan_id] || ['thumb + small images', '250 calls/month']).map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                    {feat}
                  </div>
                ))}
              </div>
            </div>

            {/* Test API */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Test Your API Connection</h2>
              <p className="text-gray-400 text-sm mb-4">Click below to send an authenticated request to the usage endpoint.</p>
              <div className="flex gap-3">
                <button
                  onClick={testApiCall}
                  className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Test GET /api/v1/usage
                </button>
                <Link
                  href="/developers/api"
                  className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium border border-gray-700 transition-colors"
                >
                  View Full Docs
                </Link>
              </div>
              {sampleError && <div className="mt-3 text-sm text-red-400">{sampleError}</div>}
              {testResult && (
                <div className="mt-4">
                  <div className="text-xs text-gray-500 mb-2">Response:</div>
                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-green-400 overflow-x-auto leading-relaxed">
                    {testResult}
                  </pre>
                </div>
              )}
            </div>

            {/* Switch account */}
            <div className="text-center pt-4">
              <button
                onClick={() => { setCustomer(null); setApiKeyInput(''); setTestResult(null); }}
                className="text-sm text-gray-500 hover:text-gray-300"
              >
                ← Look up a different API key
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
