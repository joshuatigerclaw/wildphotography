'use client';

import { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  company: string;
  plan: string;
  intended_use: string;
  monthly_needs: string;
  message: string;
}

const PLANS = [
  { slug: 'explorer', name: 'Explorer Developer', price: '$24/mo launch', regular: '$49/mo' },
  { slug: 'professional', name: 'Professional Tourism', price: '$99/mo launch', regular: '$199/mo' },
  { slug: 'enterprise', name: 'AI & Enterprise Vision', price: 'Contact for pricing', regular: 'Starting $999/mo' },
];

export default function ApiAccessForm() {
  const [form, setForm] = useState<FormData>({
    name: '', email: '', company: '', plan: 'explorer',
    intended_use: '', monthly_needs: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.intended_use) {
      setError('Please fill in your name, email, and intended use.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/api-access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Submission failed');
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again or email josh@wildphotography.com directly.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-8 text-center">
        <div className="text-3xl mb-4">✉️</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Request Received</h3>
        <p className="text-gray-600">
          Thank you — your early access request has been sent. Joshua will review your use case and follow up at the email you provided.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input name="name" value={form.name} onChange={handleChange} required
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} required
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company or Website</label>
          <input name="company" value={form.company} onChange={handleChange}
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Selected Plan</label>
          <select name="plan" value={form.plan} onChange={handleChange}
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500">
            {PLANS.map(p => (
              <option key={p.slug} value={p.slug}>{p.name} — {p.price}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Intended Use *</label>
        <select name="intended_use" value={form.intended_use} onChange={handleChange} required
          className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="">Select a use case...</option>
          <option value="ai-travel-agent">AI Travel Agent</option>
          <option value="travel-blog">Travel Blog</option>
          <option value="tourism-platform">Tourism Platform</option>
          <option value="hotel-resort">Hotel / Resort Website</option>
          <option value="tour-operator">Tour Operator</option>
          <option value="publisher">Publisher / Media Company</option>
          <option value="wildlife-education">Wildlife Education Platform</option>
          <option value="conservation">Conservation Organization</option>
          <option value="seo-content">Automated SEO Content System</option>
          <option value="newsletter">Newsletter / Social Media Workflow</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Image / API Needs</label>
        <select name="monthly_needs" value={form.monthly_needs} onChange={handleChange}
          className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="">Select...</option>
          <option value="under-100">Under 100 images/month</option>
          <option value="100-300">100–300 images/month</option>
          <option value="300-750">300–750 images/month</option>
          <option value="750-2000">750–2,000 images/month</option>
          <option value="2000+">2,000+ images/month</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea name="message" value={form.message} onChange={handleChange} rows={3}
          placeholder="Tell us about your project or specific requirements..."
          className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition disabled:opacity-60">
        {submitting ? 'Submitting...' : 'Apply for Early Access'}
      </button>
    </form>
  );
}