'use client';

import { useState } from 'react';

const PLANS = [
  { value: 'explorer', label: 'Explorer Developer — $24/mo launch' },
  { value: 'professional', label: 'Professional Tourism — $99/mo launch' },
  { value: 'enterprise', label: 'AI & Enterprise Vision — $499/mo launch' },
];

const MONTHLY_NEEDS = [
  { value: 'under-100', label: 'Under 100 calls/month' },
  { value: '100-250', label: '100–250 calls/month' },
  { value: '250-500', label: '250–500 calls/month' },
  { value: '500-1000', label: '500–1,000 calls/month' },
  { value: 'over-1000', label: 'Over 1,000 calls/month' },
];

export default function ApiAccessForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value,
      website: (form.elements.namedItem('website') as HTMLInputElement).value,
      selected_plan: (form.elements.namedItem('selected_plan') as HTMLSelectElement).value,
      intended_use: (form.elements.namedItem('intended_use') as HTMLTextAreaElement).value,
      monthly_api_needs: (form.elements.namedItem('monthly_api_needs') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };

    if (!data.name || !data.email || !data.selected_plan) {
      setStatus('error');
      setMessage('Please fill in all required fields.');
      return;
    }

    try {
      const res = await fetch('/api/api-access/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStatus('success');
        setMessage(json.message || 'Application received. We will review your request and contact you with onboarding instructions.');
        form.reset();
      } else {
        setStatus('error');
        setMessage(json.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="form-success">
        <div className="form-success-icon">✓</div>
        <h3>Application Received</h3>
        <p>{message}</p>
        <button className="btn-reset" onClick={() => setStatus('idle')}>Submit another</button>
      </div>
    );
  }

  return (
    <form className="api-form" onSubmit={handleSubmit} noValidate>
      {status === 'error' && (
        <div className="form-error-banner">
          {message}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="name">Full Name <span className="required">*</span></label>
          <input type="text" id="name" name="name" required placeholder="Jane Smith" />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email <span className="required">*</span></label>
          <input type="email" id="email" name="email" required placeholder="jane@example.com" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="company">Company / Organization</label>
          <input type="text" id="company" name="company" placeholder="Acme Travel Co." />
        </div>
        <div className="form-group">
          <label htmlFor="website">Website</label>
          <input type="url" id="website" name="website" placeholder="https://example.com" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="selected_plan">Selected Plan <span className="required">*</span></label>
        <select id="selected_plan" name="selected_plan" required defaultValue="">
          <option value="" disabled>Select a plan…</option>
          {PLANS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="intended_use">Intended Use</label>
        <textarea
          id="intended_use"
          name="intended_use"
          rows={3}
          placeholder="Describe how you plan to use the API — e.g. automated travel blog, AI content agent, tourism platform..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="monthly_api_needs">Estimated Monthly API Calls</label>
        <select id="monthly_api_needs" name="monthly_api_needs" defaultValue="">
          <option value="" disabled>Select a range…</option>
          {MONTHLY_NEEDS.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="message">Additional Notes</label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Any questions or specific requirements…"
        />
      </div>

      <button type="submit" className="btn-submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Submitting…' : 'Submit Application'}
      </button>

      <style>{`
        .api-form { display: flex; flex-direction: column; gap: 20px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 14px; font-weight: 500; color: var(--ink, #1a1a1a); }
        .required { color: #dc2626; }
        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 10px 14px;
          border: 1px solid rgba(0,0,0,0.15);
          border-radius: 8px;
          font-size: 15px;
          font-family: inherit;
          background: white;
          color: var(--ink, #1a1a1a);
          outline: none;
          transition: border-color .2s;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: var(--accent, #2e7d32);
          box-shadow: 0 0 0 3px rgba(46,125,50,0.1);
        }
        .form-group textarea { resize: vertical; min-height: 80px; }
        .form-error-banner {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
        }
        .btn-submit {
          align-self: flex-start;
          padding: 12px 28px;
          background: var(--accent, #2e7d32);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: background .2s;
        }
        .btn-submit:hover:not(:disabled) { background: #1b5e20; }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .form-success {
          text-align: center;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .form-success-icon {
          width: 56px;
          height: 56px;
          background: #dcfce7;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: #16a34a;
        }
        .form-success h3 { font-size: 18px; font-weight: 600; margin: 0; }
        .form-success p { font-size: 15px; color: var(--ink-muted, #666); margin: 0; line-height: 1.6; }
        .btn-reset {
          background: none;
          border: none;
          color: var(--accent, #2e7d32);
          font-size: 14px;
          cursor: pointer;
          text-decoration: underline;
          margin-top: 8px;
        }
        @media (max-width: 500px) {
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </form>
  );
}