import type { Metadata } from 'next';
import Link from 'next/link';
import ApiAccessForm from '@/components/ApiAccessForm';

export const metadata: Metadata = {
  title: 'WildPhotography API Access | Real Costa Rica Wildlife & Travel Photography API',
  description:
    'Access authentic Costa Rica wildlife, travel, destination, and nature photography through the WildPhotography API. Built for AI agents, tourism platforms, publishers, hotels, content creators, and automated SEO workflows.',
  alternates: {
    canonical: 'https://wildphotography.com/api-access',
  },
  openGraph: {
    title: 'WildPhotography API Access | Real Costa Rica Wildlife & Travel Photography API',
    description:
      'Access authentic Costa Rica wildlife, travel, destination, and nature photography through a modern API built for AI agents, tourism platforms, publishers, and automated content systems.',
    url: 'https://wildphotography.com/api-access',
    siteName: 'WildPhotography',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WildPhotography API Access',
    description: 'Access real Costa Rica wildlife and travel photography through a modern API built for AI agents, tourism platforms, and automated content systems.',
  },
};

const PLANS = [
  {
    slug: 'explorer',
    name: 'Explorer Developer',
    launch: '$24',
    launchPeriod: '/month',
    regular: '$49/month',
    apiCalls: '250 API calls/month',
    bestFor: 'Bloggers, indie developers, small travel websites, content creators, and startup MVPs.',
    features: [
      '250 API calls per month',
      'Thumbnail and small image access',
      'Wildlife and destination search',
      'Keywords included for each photo',
      'Attribution license required',
      'Developer documentation',
      'Ideal for travel blogs, Costa Rica guides, and early-stage projects',
    ],
    cta: 'Apply for Explorer Access',
    highlight: false,
  },
  {
    slug: 'professional',
    name: 'Professional Tourism',
    launch: '$99',
    launchPeriod: '/month',
    regular: '$199/month',
    apiCalls: '750 API calls/month',
    bestFor: 'Hotels, tour operators, tourism companies, publishers, destination websites, and content teams.',
    features: [
      '750 API calls per month',
      'Thumbnail, small, and medium image access',
      'Commercial usage rights',
      'No attribution required',
      'Advanced keyword and location metadata',
      'Gallery and destination queries',
      'Ideal for tourism marketing, hotel websites, travel publishing, and SEO content production',
    ],
    cta: 'Apply for Professional Access',
    highlight: true,
  },
  {
    slug: 'enterprise',
    name: 'AI & Enterprise Vision',
    launch: '$499',
    launchPeriod: '+ /month',
    regular: 'Starting $999/month',
    apiCalls: '2,000 API calls/month',
    bestFor: 'AI travel agents, LLM content systems, tourism boards, enterprise publishers, airline destination systems, and wildlife intelligence platforms.',
    features: [
      '2,000 API calls per month',
      'Thumbnail, small, medium, and large image access',
      'AI agent integration rights',
      'Semantic and keyword search',
      'Enterprise licensing options',
      'Custom collections',
      'Dedicated support',
      'Ideal for automated content generation, AI travel assistants, and high-volume publishing systems',
    ],
    cta: 'Contact for Enterprise Access',
    highlight: false,
  },
];

const USE_CASES = [
  { label: 'AI travel agents', icon: '🤖' },
  { label: 'Travel blogs', icon: '✈️' },
  { label: 'Costa Rica guide websites', icon: '🌎' },
  { label: 'Hotel and resort websites', icon: '🏨' },
  { label: 'Tourism boards', icon: '📍' },
  { label: 'Tour operators', icon: '🗺️' },
  { label: 'Wildlife education platforms', icon: '🦜' },
  { label: 'Conservation organizations', icon: '🌿' },
  { label: 'Publishers and media companies', icon: '📰' },
  { label: 'Automated SEO content systems', icon: '⚡' },
  { label: 'Newsletters and social media workflows', icon: '📧' },
];

const CAPABILITIES = [
  {
    title: 'Wildlife Photography API',
    desc: 'Search and retrieve real Costa Rica wildlife images by species, habitat, location, keywords, and gallery.',
  },
  {
    title: 'Destination Photography API',
    desc: 'Access Costa Rica beaches, volcanoes, waterfalls, rainforest, surf towns, national parks, drone imagery, and travel scenes.',
  },
  {
    title: 'Keyword Metadata for Content Creation',
    desc: 'Each photo includes descriptive keywords to help generate articles, captions, SEO pages, destination guides, social media posts, and AI-assisted content.',
  },
  {
    title: 'Agentic Image Discovery',
    desc: 'Built for automated systems that need to search, select, and insert real images into content workflows without manually downloading stock images.',
  },
];

const FAQS = [
  {
    q: 'Are these AI-generated images?',
    a: 'No. WildPhotography API provides access to real photography from Costa Rica, including wildlife, destinations, aerial imagery, and nature scenes.',
  },
  {
    q: 'Do API responses include keywords?',
    a: 'Yes. Each photo includes keywords and metadata designed to help with content creation, SEO, captions, article writing, and automated publishing workflows.',
  },
  {
    q: 'Can I use the API with AI agents?',
    a: 'Yes. The AI & Enterprise Vision plan is designed for agentic workflows, LLM content systems, AI travel assistants, and automated publishing systems.',
  },
  {
    q: 'Can I use the images commercially?',
    a: 'Commercial usage is available in the Professional Tourism and AI & Enterprise Vision plans. The Explorer Developer plan requires attribution and is intended for smaller projects and development use.',
  },
  {
    q: 'Are original image files exposed through the API?',
    a: 'No. The API only exposes approved derivative images based on the customer\'s membership plan. Original files remain private.',
  },
];

const EXAMPLE_REQUESTS = [
  "GET /api/v1/search?q=sloth+manuel+antonio",
  "GET /api/v1/search?q=scarlet+macaw&gallery=osa-peninsula",
  "GET /api/v1/search?location=monteverde&per_page=10",
];

const EXAMPLE_RESPONSE = `{
  "query": "sloth manuel antonio",
  "total": 1,
  "photos": [{
    "id": "12345",
    "title": "Two-toed Sloth in Manuel Antonio Rainforest",
    "slug": "sloth-manuel-antonio-rainforest",
    "keywords": ["sloth", "Costa Rica wildlife", "Manuel Antonio", "rainforest", "eco tourism", "two-toed sloth", "mammal"],
    "locationName": "Manuel Antonio, Costa Rica",
    "gallerySlug": "manuel-antonio-wildlife",
    "thumbUrl": "https://images.wildphotography.com/derivatives/thumb/...",
    "smallUrl": "https://images.wildphotography.com/derivatives/small/...",
    "canonicalUrl": "https://wildphotography.com/photo/sloth-manuel-antonio-rainforest"
  }]
}`;

export default function ApiAccessPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="relative bg-stone-900 text-white py-28 px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'url(https://images.wildphotography.com/photos/macaw-open-beak-green-1500.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-amber-400 font-mono text-xs tracking-widest uppercase mb-5">
            Developer API
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6">
            Real Costa Rica Wildlife &amp; Travel Photography — Delivered by API
          </h1>
          <p className="text-lg md:text-xl text-stone-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Access verified real-world photography from WildPhotography.com through a modern API built for travel websites, AI agents, tourism platforms, publishers, hotels, and automated content systems.
          </p>
          <a
            href="#apply"
            className="inline-flex items-center gap-2 px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition text-lg"
          >
            Apply for Early Access
          </a>
        </div>
      </section>

      {/* ── Intro ── */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-lg text-gray-600 leading-relaxed">
          WildPhotography API gives developers, tourism companies, AI platforms, publishers, hotels, and content creators access to authentic Costa Rica wildlife and destination photography through a structured API. Each photo includes useful keywords and metadata to help with content creation, SEO, article writing, social media publishing, and agentic search workflows.
        </p>
        <p className="text-lg text-gray-600 leading-relaxed mt-5">
          Unlike generic stock image sites or AI-generated images, WildPhotography provides real photography from Costa Rica, organized by species, destination, gallery, keyword, and location.
        </p>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-5xl mx-auto px-4"><hr className="border-stone-200" /></div>

      {/* ── What You Can Access ── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-display font-bold text-gray-900 mb-10 text-center">
          What You Can Access
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="bg-stone-50 border border-stone-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{cap.title}</h3>
              <p className="text-gray-600 leading-relaxed">{cap.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="bg-stone-50 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-gray-900 mb-10 text-center">
            Built For
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {USE_CASES.map((uc) => (
              <span
                key={uc.label}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 rounded-full text-sm text-gray-700"
              >
                <span>{uc.icon}</span>
                {uc.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cost Advantage ── */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-display font-bold text-gray-900 mb-6">
          A More Efficient Alternative to Traditional Stock Photography
        </h2>
        <div className="space-y-4 text-gray-600 text-lg leading-relaxed">
          <p>
            Traditional stock photography platforms such as Adobe Stock, Shutterstock, Getty Images, and similar services are usually built around manual image search, individual downloads, and traditional licensing workflows. That can work for occasional image needs, but it becomes inefficient when a website, AI agent, or content system needs to find and use images programmatically.
          </p>
          <p>
            WildPhotography API is designed for automated image discovery. Instead of manually searching stock sites every time you create a page, article, travel guide, or social post, your system can query the API and receive real Costa Rica wildlife and travel images with keywords and metadata included.
          </p>
          <p>
            This can be more cost-effective for high-volume image needs, designed to reduce manual image sourcing time, helps automate image discovery, and supports programmatic publishing workflows.
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-5xl mx-auto px-4"><hr className="border-stone-200" /></div>

      {/* ── Membership Plans ── */}
      <section className="max-w-6xl mx-auto px-4 py-16" id="plans">
        <h2 className="text-3xl font-display font-bold text-gray-900 mb-4 text-center">
          Membership Plans
        </h2>
        <p className="text-center text-gray-500 mb-12">
          Choose the plan that matches your use case. All plans include keyword metadata and search functionality.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`rounded-2xl border-2 p-6 flex flex-col ${
                plan.highlight
                  ? 'border-amber-500 bg-amber-50 shadow-lg'
                  : 'border-stone-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <span className="inline-block w-fit px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-full mb-4">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-gray-900">{plan.launch}</span>
                <span className="text-gray-500">{plan.launchPeriod}</span>
              </div>
              <p className="text-sm text-gray-400 line-through mb-3">{plan.regular}</p>
              <p className="text-sm font-medium text-gray-700 mb-4">{plan.apiCalls}</p>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">{plan.bestFor}</p>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#apply"
                className={`block text-center px-6 py-3 font-semibold rounded-lg transition ${
                  plan.highlight
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-stone-900 hover:bg-stone-800 text-white'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Launch Discount ── */}
      <section className="bg-stone-900 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-display font-bold mb-3">
            50% Founding Member Launch Discount
          </h2>
          <p className="text-stone-300 leading-relaxed">
            Founding members receive special launch pricing during the early access period.
            The launch price reflects a 50% discount from the regular monthly membership price.
            Early members also receive priority onboarding and direct feedback access as the API platform expands.
          </p>
        </div>
      </section>

      {/* ── Example API Requests ── */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-display font-bold text-gray-900 mb-6">
          Example API Requests
        </h2>
        <div className="bg-stone-900 rounded-xl p-6 overflow-x-auto">
          <pre className="text-sm text-green-400 font-mono leading-relaxed">
{EXAMPLE_REQUESTS.map(r => <div key={r}>{r}</div>)}
          </pre>
        </div>
      </section>

      {/* ── Example API Response ── */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-display font-bold text-gray-900 mb-6">
          Example API Response
        </h2>
        <div className="bg-stone-900 rounded-xl p-6 overflow-x-auto">
          <pre className="text-sm text-green-400 font-mono leading-relaxed whitespace-pre-wrap">
{EXAMPLE_RESPONSE}
          </pre>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          Image derivative sizes returned depend on your membership plan. Explorer includes thumbnail and small. Professional adds medium. Enterprise adds large. Original files are never exposed.
        </p>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-5xl mx-auto px-4"><hr className="border-stone-200" /></div>

      {/* ── Signup Instructions ── */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-display font-bold text-gray-900 mb-4">
          How to Get API Access
        </h2>
        <ol className="space-y-3 mb-10">
          {[
            'Choose the membership plan that matches your use case.',
            'Submit the early access request form below.',
            'Include your website, company, or project description.',
            'WildPhotography will review your use case and activate your API membership.',
            'Once approved, you will receive API documentation, an API key, and setup instructions.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-gray-700">{step}</span>
            </li>
          ))}
        </ol>

        {/* ── Application Form ── */}
        <div id="apply" className="bg-white border border-stone-200 rounded-2xl p-6 md:p-10">
          <h3 className="text-2xl font-display font-bold text-gray-900 mb-2">
            Apply for Early Access
          </h3>
          <p className="text-gray-500 mb-8">
            Complete the form and Joshua will review your use case. Approval typically takes 1–2 business days.
          </p>
          <ApiAccessForm />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-stone-50 py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-gray-900 mb-10 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-white border border-stone-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 mt-8">
            Have more questions?{' '}
            <a href="mailto:josh@wildphotography.com" className="text-amber-600 hover:underline">
              Email Joshua directly
            </a>
            .
          </p>
        </div>
      </section>

      {/* ── Related Links ── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-display font-bold text-gray-900 mb-8">
          Explore the Collection
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Photo Galleries', href: '/galleries' },
            { label: 'Species Index', href: '/species' },
            { label: 'Costa Rica Map', href: '/map' },
            { label: 'Print Shop', href: '/prints' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block p-4 bg-stone-50 border border-stone-200 rounded-xl text-center text-gray-700 font-medium hover:bg-amber-50 hover:border-amber-300 transition"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}