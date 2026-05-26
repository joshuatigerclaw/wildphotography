'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Note = { id: number; note: string; created_at: string };
type Lead = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  selected_plan: string;
  intended_use: string | null;
  monthly_api_needs: string | null;
  message: string | null;
  status: string;
  notes: Note[];
  created_at: string;
  updated_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  explorer: 'Explorer Developer ($24/mo)',
  professional: 'Professional Tourism ($99/mo)',
  enterprise: 'AI & Enterprise Vision ($499/mo)',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  onboarded: 'Onboarded',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  approved: 'bg-blue-900/30 text-blue-400 border-blue-700',
  rejected: 'bg-red-900/30 text-red-400 border-red-700',
  onboarded: 'bg-green-900/30 text-green-400 border-green-700',
};

function Sidebar({ pathname }: { pathname: string }) {
  const nav = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '◈' },
    { href: '/admin/photos', label: 'Photo Library', icon: '◉' },
    { href: '/admin/quality', label: 'Quality Queue', icon: '◆' },
    { href: '/admin/bulk', label: 'Bulk Editor', icon: '▣' },
    { href: '/admin/api-leads', label: 'API Leads', icon: '⬡', highlight: true },
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
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
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

function LeadRow({ lead, onAction, addingNote }: { lead: Lead; onAction: (id: number, action: string, plan?: string) => void; addingNote: number | null }) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(lead.selected_plan || 'explorer');

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{lead.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[lead.status] || 'bg-gray-700/30 text-gray-400 border-gray-600'}`}>
              {STATUS_LABELS[lead.status] || lead.status}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {lead.email} {lead.company ? `· ${lead.company}` : ''}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{new Date(lead.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
        </div>

        <div className="flex flex-col gap-2 items-end">
          {lead.status === 'pending' && (
            <>
              <select
                value={selectedPlan}
                onChange={e => setSelectedPlan(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300"
              >
                <option value="explorer">Explorer ($24)</option>
                <option value="professional">Professional ($99)</option>
                <option value="enterprise">Enterprise ($499)</option>
              </select>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onAction(lead.id, 'approve', selectedPlan)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => onAction(lead.id, 'reject')}
                  className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/40 text-red-400 border border-red-800 text-xs font-medium rounded-lg transition-colors"
                >
                  Reject
                </button>
              </div>
            </>
          )}
          {lead.status === 'approved' && (
            <div className="flex gap-1.5">
              <button
                onClick={() => onAction(lead.id, 'onboard', selectedPlan)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Onboard
              </button>
            </div>
          )}
          {lead.status === 'onboarded' && (
            <span className="text-xs text-green-500">✓ Onboarded</span>
          )}
          {lead.status === 'rejected' && (
            <span className="text-xs text-red-500">✗ Rejected</span>
          )}
        </div>
      </div>

      {lead.intended_use && (
        <p className="text-sm text-gray-400 mt-3 border-t border-gray-800 pt-3">
          <span className="text-gray-500 text-xs uppercase tracking-wide">Intended use</span><br />
          {lead.intended_use}
        </p>
      )}
      {lead.message && (
        <p className="text-sm text-gray-500 mt-2 italic">"{lead.message}"</p>
      )}

      {/* Notes section */}
      <div className="mt-3 border-t border-gray-800 pt-3">
        <button
          onClick={() => setShowNote(!showNote)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          {showNote ? '▼' : '▶'} Internal Notes ({lead.notes.length})
        </button>

        {showNote && (
          <div className="mt-2">
            {lead.notes.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {lead.notes.map(n => (
                  <div key={n.id} className="bg-gray-950 rounded-lg p-3">
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">{n.note}</p>
                    <p className="text-xs text-gray-600 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
            {addingNote === lead.id ? (
              <div className="flex gap-2">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 resize-none outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => { onAction(lead.id, 'note', note); setNote(''); }}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-700"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => { onAction(lead.id, 'show-note-input'); setShowNote(true); }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add note
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardModal({ lead, onClose, onConfirm }: {
  lead: Lead & { plan_id?: string };
  onClose: () => void;
  onConfirm: (planId: string) => void;
}) {
  const [plan, setPlan] = useState(lead.plan_id || lead.selected_plan || 'explorer');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-white mb-1">Onboard {lead.name}</h2>
        <p className="text-sm text-gray-400 mb-5">This will create a customer account and generate an API key.</p>
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-400">Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="explorer">Explorer Developer — $24/mo launch (250 calls)</option>
              <option value="professional">Professional Tourism — $99/mo launch (750 calls)</option>
              <option value="enterprise">AI & Enterprise Vision — $499/mo launch (2000 calls)</option>
            </select>
          </div>
          <div className="rounded-lg bg-amber-900/20 border border-amber-800 p-3">
            <p className="text-xs text-amber-400">⚠ The full API key will be shown once and cannot be recovered. Copy it before closing.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium border border-gray-700">
            Cancel
          </button>
          <button onClick={() => onConfirm(plan)} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium">
            Onboard & Generate Key
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeyModal({ onboardingText, onClose }: { onboardingText: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const apiKeyMatch = onboardingText.match(/wpa_[A-Za-z0-9_-]+/);
  const apiKey = apiKeyMatch ? apiKeyMatch[0] : '';

  function copyKey() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-1">API Key Generated</h2>
        <p className="text-sm text-green-400 mb-4">✓ Customer created. Copy the key below — it is shown only once.</p>
        <textarea readOnly value={onboardingText} rows={16}
          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono leading-relaxed mb-4" />
        <div className="flex gap-3">
          <button onClick={copyKey}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            {copied ? '✓ Copied' : 'Copy API Key'}
          </button>
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium border border-gray-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApiLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState<Lead | null>(null);
  const [apiKeyModal, setApiKeyModal] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/api-leads', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function handleAction(id: number, action: string, planOrNote?: string) {
    if (action === 'show-note-input') { setNoteFor(id); return; }
    if (action === 'note') {
      if (!planOrNote?.trim()) return;
      setActionLoading(id);
      try {
        const res = await fetch(`/api/admin/api-leads/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: planOrNote }),
        });
        if (res.ok) {
          const data = await res.json();
          setLeads(prev => prev.map(l => l.id === id ? data.lead : l));
        }
      } finally {
        setActionLoading(null);
        setNoteFor(null);
      }
      return;
    }
    if (action === 'onboard') {
      setShowOnboardModal(leads.find(l => l.id === id) || null);
      return;
    }

    setActionLoading(id);
    try {
      const body: Record<string, string> = { action };
      if (planOrNote) body.assigned_plan = planOrNote;
      const res = await fetch(`/api/admin/api-leads/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(prev => prev.map(l => l.id === id ? data.lead : l));
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOnboardConfirm(planId: string) {
    if (!showOnboardModal) return;
    const id = showOnboardModal.id;
    setShowOnboardModal(null);
    setActionLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/api-leads/${id}/onboard`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (res.ok) {
        setApiKeyModal(data.onboarding_text);
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'onboarded' } : l));
      } else {
        setError(data.error || 'Onboarding failed');
      }
    } catch {
      setError('Network error during onboarding');
    } finally {
      setActionLoading(null);
    }
  }

  const counts = {
    all: leads.length,
    pending: leads.filter(l => l.status === 'pending').length,
    approved: leads.filter(l => l.status === 'approved').length,
    rejected: leads.filter(l => l.status === 'rejected').length,
    onboarded: leads.filter(l => l.status === 'onboarded').length,
  };

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Sidebar pathname={pathname} />
      <div className="pl-56">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">API Leads</h1>
              <p className="text-sm text-gray-500 mt-1">Review applications, approve, onboard, and generate API keys</p>
            </div>
            <button onClick={fetchLeads} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700">
              ↻ Refresh
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {(['all', 'pending', 'approved', 'rejected', 'onboarded'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  filter === f
                    ? 'bg-blue-600/20 text-blue-400 border-blue-700'
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700'
                }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)} {counts[f] > 0 && `(${counts[f]})`}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-900 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-600">No leads in this category.</div>
          ) : (
            <div className="space-y-4">
              {filtered.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onAction={handleAction}
                  addingNote={noteFor}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showOnboardModal && (
        <OnboardModal
          lead={showOnboardModal}
          onClose={() => setShowOnboardModal(null)}
          onConfirm={handleOnboardConfirm}
        />
      )}
      {apiKeyModal && (
        <ApiKeyModal onboardingText={apiKeyModal} onClose={() => setApiKeyModal(null)} />
      )}
    </div>
  );
}