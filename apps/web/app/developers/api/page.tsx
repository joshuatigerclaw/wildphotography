import { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'WildPhotography API Documentation | Real Costa Rica Wildlife Photography API',
  description:
    'Complete reference for the WildPhotography API. Authenticate with a Bearer token, search real Costa Rica wildlife and travel photos, and check usage quotas. Built for AI agents, tourism platforms, and content automation.',
  alternates: { canonical: '/developers/api' },
  openGraph: {
    title: 'WildPhotography API Documentation',
    description:
      'Complete reference for the WildPhotography API. Access real Costa Rica wildlife, travel, destination, and nature photography through a clean REST API.',
    url: `${SITE_URL}/developers/api`,
    siteName: 'WildPhotography',
    type: 'website',
  },
};

const EXAMPLE_RESPONSE = {
  photos: [
    {
      id: '32314',
      slug: 'scarlet-macaw-toucan-bar-u-with-scenic-ocean-view',
      title: 'Scarlet Macaw and Toucan Bar UFO with Scenic Ocean View',
      keywords: 'scarlet macaw, toucan bar, scenic ocean view, Costa Rica, wildlife, bird, psittaciformes, ramphastidae, aerial',
      locationName: 'Uvita',
      speciesName: 'Scarlet Macaw',
      thumbUrl: 'https://images.wildphotography.com/_thumbs/0443/scarlet-macaw-toucan-bar-u-with-scenic-ocean-view.jpg',
      smallUrl: 'https://images.wildphotography.com/_smalls/0443/scarlet-macaw-toucan-bar-u-with-scenic-ocean-view.jpg',
      mediumUrl: 'https://images.wildphotography.com/_medium/0443/scarlet-macaw-toucan-bar-u-with-scenic-ocean-view.jpg',
      largeUrl: 'https://images.wildphotography.com/_large/0443/scarlet-macaw-toucan-bar-u-with-scenic-ocean-view.jpg',
      canonicalUrl: 'https://wildphotography.com/photo/scarlet-macaw-toucan-bar-u-with-scenic-ocean-view',
      _meta: {
        plan: 'professional',
        allowed_derivatives: ['thumb', 'small', 'medium'],
        attribution_required: false,
      },
    },
  ],
  total: 1,
  page: 1,
  per_page: 3,
  hasMore: false,
  quota: {
    plan: 'Professional Tourism',
    limit: 750,
    resetsAt: '2026-06-01',
  },
};

const EXAMPLE_USAGE = {
  plan: 'Professional Tourism',
  limit: 750,
  used: 214,
  remaining: 536,
  resetsAt: '2026-06-01',
  period: '2026-05',
};

const ERROR_CODES = [
  { code: 401, label: 'Unauthorized', description: 'Invalid or missing API key. Include a valid Bearer wpa_... key in the Authorization header.' },
  { code: 403, label: 'Forbidden', description: 'Account is inactive. Contact support to reactivate your subscription.' },
  { code: 429, label: 'Quota Exceeded', description: 'Monthly call limit reached. Resets on the 1st of the next month.' },
  { code: 500, label: 'Server Error', description: 'An internal error occurred. Retry after a few seconds.' },
];

const PLANS = [
  {
    id: 'explorer',
    name: 'Explorer Developer',
    price: '$24/mo',
    calls: '250 calls/month',
    images: 'thumb + small',
    attribution: 'Attribution required',
    use: 'Personal, blog, dev projects',
  },
  {
    id: 'professional',
    name: 'Professional Tourism',
    price: '$99/mo',
    calls: '750 calls/month',
    images: 'thumb + small + medium',
    attribution: 'No attribution required',
    use: 'Commercial, hotels, publishers, travel sites',
  },
  {
    id: 'enterprise',
    name: 'AI & Enterprise Vision',
    price: '$499/mo',
    calls: '2,000 calls/month',
    images: 'thumb + small + medium + large',
    attribution: 'No attribution required',
    use: 'AI agents, enterprise licensing, automated publishing',
  },
];

export default function DevelopersApiPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top nav */}
      <div className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="text-white font-bold text-lg hover:text-blue-400">WildPhotography</Link>
            <span className="text-gray-500 text-sm ml-2">API Documentation</span>
          </div>
          <Link
            href="/api-access"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Get API Access
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-14">
          <h1 className="text-4xl font-extrabold text-white mb-4">WildPhotography API</h1>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">
            Access real Costa Rica wildlife, travel, destination, and nature photography — authenticated, metadata-rich, and built for AI agents, tourism platforms, and content automation.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-16">
          {/* Overview */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
            <p className="text-gray-400 leading-relaxed">
              The WildPhotography API provides authenticated access to a curated library of real Costa Rica photography. Each result includes title, keywords, location, species data, and approved image derivatives — perfect for content creation, SEO automation, AI agents, and tourism platforms. Original files and raw storage keys are never exposed.
            </p>
          </section>

          {/* Authentication */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
            <p className="text-gray-400 mb-4">Include your API key in every request using the <span className="text-white font-mono bg-gray-900 px-2 py-1 rounded">Authorization</span> header with a Bearer token:</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 font-mono text-sm text-green-400 mb-4">
              <div className="text-gray-500 mb-2"># Header format</div>
              <div>Authorization: Bearer <span className="text-yellow-300">wpa_YOUR_API_KEY_HERE</span></div>
            </div>
            <p className="text-sm text-gray-500">
              API keys are generated after onboarding and start with the prefix <span className="text-white font-mono bg-gray-900 px-1.5 py-0.5 rounded text-xs">wpa_</span>. Your full key is shown only once at generation — store it securely.
            </p>
          </section>

          {/* Base URL */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Base URL</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 font-mono text-sm text-green-400">
              https://www.wildphotography.com
            </div>
          </section>

          {/* Endpoints */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Endpoints</h2>
            <div className="space-y-3">
              {[
                { method: 'GET', path: '/api/v1/search', desc: 'Search photos by keyword, species, location, or gallery. Returns paginated results with metadata and approved image URLs.' },
                { method: 'GET', path: '/api/v1/usage', desc: 'Check current monthly usage, remaining quota, plan limits, and the next reset date.' },
              ].map(({ method, path, desc }) => (
                <div key={path} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
                  <span className={`flex-shrink-0 mt-0.5 px-2 py-1 rounded text-xs font-bold ${
                    method === 'GET' ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-blue-900/40 text-blue-400 border border-blue-800'
                  }`}>{method}</span>
                  <div>
                    <span className="font-mono text-white text-sm">{path}</span>
                    <p className="text-gray-400 text-sm mt-1">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Search Example */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Search Example</h2>
            <p className="text-gray-400 mb-4">Search for &ldquo;toucan&rdquo; and return 3 results:</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 font-mono text-sm text-green-400 mb-4 overflow-x-auto whitespace-nowrap">
              <div className="text-gray-500 mb-2"># Request</div>
              <div>GET https://www.wildphotography.com/api/v1/search?q=toucan&per_page=3</div>
              <div className="text-gray-500 mt-4 mb-2"># Response</div>
              <div className="text-yellow-200">{JSON.stringify(EXAMPLE_RESPONSE, null, 2)}</div>
            </div>
          </section>

          {/* Usage Example */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Usage Example</h2>
            <p className="text-gray-400 mb-4">Check your current quota:</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 font-mono text-sm text-green-400 mb-4 overflow-x-auto whitespace-nowrap">
              <div className="text-gray-500 mb-2"># Request</div>
              <div>GET https://www.wildphotography.com/api/v1/usage</div>
              <div className="text-gray-500 mt-4 mb-2"># Response</div>
              <div className="text-yellow-200">{JSON.stringify(EXAMPLE_USAGE, null, 2)}</div>
            </div>
          </section>

          {/* Plan Limits */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Plan Limits</h2>
            <div className="space-y-4">
              {PLANS.map(plan => (
                <div key={plan.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
                      <p className="text-2xl font-bold text-blue-400 mt-1">{plan.price}</p>
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-800 px-3 py-1 rounded-full">{plan.calls}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-400">Images</div>
                    <div className="text-white">{plan.images}</div>
                    <div className="text-gray-400">Attribution</div>
                    <div className="text-white">{plan.attribution}</div>
                    <div className="text-gray-400">Use case</div>
                    <div className="text-white">{plan.use}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Safety & Licensing */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Safety & Licensing</h2>
            <ul className="space-y-3">
              {[
                'Original full-resolution files are never exposed through the API.',
                'Raw R2 storage keys are never returned — responses include only approved CDN derivatives.',
                'Return fields depend on plan tier. Higher tiers unlock larger image sizes.',
                'Keywords and metadata are included for content creation, SEO, and AI training augmentation.',
                'Commercial and AI use require the appropriate plan tier.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-400">
                  <span className="flex-shrink-0 mt-1 w-2 h-2 rounded-full bg-blue-600" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Error Codes */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Error Codes</h2>
            <div className="space-y-3">
              {ERROR_CODES.map(({ code, label, description }) => (
                <div key={code} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
                  <span className="flex-shrink-0 px-2.5 py-1 rounded text-sm font-mono font-bold bg-red-900/30 text-red-400 border border-red-800">{code}</span>
                  <div>
                    <span className="text-white font-medium">{label}</span>
                    <p className="text-gray-400 text-sm mt-0.5">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-800/50 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to get started?</h2>
            <p className="text-gray-400 mb-6">Apply for API access and get your key in minutes.</p>
            <Link
              href="/api-access"
              className="inline-block px-8 py-3 text-base bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
            >
              Apply for API Access
            </Link>
          </section>
        </div>

        {/* Footer link */}
        <div className="mt-14 pt-8 border-t border-gray-800 text-center">
          <Link href="/api-access" className="text-sm text-gray-500 hover:text-blue-400">← Back to API Access</Link>
        </div>
      </div>
    </div>
  );
}
