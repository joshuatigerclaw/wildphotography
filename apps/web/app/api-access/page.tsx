import { Metadata } from 'next';
import Link from 'next/link';
import ApiAccessForm from './form';

const SITE_URL = 'https://wildphotography.com';

export const metadata: Metadata = {
  title: 'WildPhotography API Access | Real Costa Rica Wildlife & Travel Photography API',
  description:
    'Access authentic Costa Rica wildlife, travel, destination, and nature photography through the WildPhotography API. Built for AI agents, tourism platforms, publishers, hotels, content creators, and automated SEO workflows.',
  alternates: { canonical: '/api-access' },
  openGraph: {
    title: 'WildPhotography API Access | Real Costa Rica Wildlife & Travel Photography API',
    description:
      'Access authentic Costa Rica wildlife, travel, destination, and nature photography through a modern API built for AI agents, tourism platforms, publishers, travel websites, and automated content systems.',
    url: `${SITE_URL}/api-access`,
    siteName: 'WildPhotography',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WildPhotography API Access',
    description: 'Real Costa Rica wildlife and travel photography API for AI agents, tourism platforms, and content automation.',
  },
};

const PLANS = [
  {
    id: 'explorer',
    name: 'Explorer Developer',
    launchPrice: 24,
    regularPrice: 49,
    apiCalls: '250/month',
    features: [
      'Thumb + small image access',
      'Keywords included',
      'Attribution required',
      'Species and destination search',
      'Ideal for bloggers, developers, and small travel sites',
    ],
    highlight: false,
  },
  {
    id: 'professional',
    name: 'Professional Tourism',
    launchPrice: 99,
    regularPrice: 199,
    apiCalls: '750/month',
    features: [
      'Thumb + small + medium image access',
      'Commercial use',
      'No attribution required',
      'Advanced metadata',
      'Ideal for hotels, tour operators, publishers, and tourism sites',
    ],
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'AI & Enterprise Vision',
    launchPrice: 499,
    regularPrice: 999,
    apiCalls: '2,000/month',
    features: [
      'Thumb + small + medium + large image access',
      'AI agent integration rights',
      'Enterprise licensing',
      'Custom collections',
      'Ideal for AI travel agents, tourism boards, and automated publishing systems',
    ],
    highlight: false,
  },
];

const FAQ = [
  {
    q: 'Are these AI-generated images?',
    a: 'No. These are real Costa Rica photographs taken by professional wildlife photographer Joshua ten Brink, who has spent years documenting Costa Rica\'s wildlife and landscapes.',
  },
  {
    q: 'Are keywords included?',
    a: 'Yes. Each photo includes keywords, species names, location data, and metadata optimized for SEO, captions, articles, and automated content workflows.',
  },
  {
    q: 'Can AI agents use the API?',
    a: 'Yes. The Enterprise plan is specifically designed for agentic and AI-powered workflows, including AI travel agents, automated content generation systems, and dynamic page building.',
  },
  {
    q: 'Are original full-resolution images exposed?',
    a: 'No. Only approved derivative images (thumb, small, medium, large) are returned through the API. Original files are never exposed.',
  },
  {
    q: 'Can I use the images commercially?',
    a: 'Commercial use is included in the Professional and Enterprise plans. The Explorer plan requires attribution. Review the full terms of service during onboarding.',
  },
  {
    q: 'How does the API fit into a content workflow?',
    a: 'The API is designed for programmatic access. You can query by species, location, keyword, or combination — and receive structured photo data including direct URLs to approved derivatives ready for display or download.',
  },
];

export default function ApiAccessPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'WildPhotography API Access',
            description:
              'Access authentic Costa Rica wildlife, travel, destination, and nature photography through the WildPhotography API.',
            url: `${SITE_URL}/api-access`,
            isPartOf: { '@type': 'WebSite', name: 'WildPhotography', url: SITE_URL },
          }),
        }}
      />

      <div className="api-access-page">
        {/* Hero */}
        <section className="api-hero">
          <div className="api-hero-inner">
            <div className="api-hero-badge">Developer API</div>
            <h1 className="api-hero-title">
              Real Costa Rica Wildlife & Travel Photography — Delivered by API
            </h1>
            <p className="api-hero-sub">
              Access authentic Costa Rica wildlife, destination, aerial, and travel photography
              through a modern API built for AI agents, tourism platforms, publishers, travel
              websites, and automated content systems.
            </p>
            <div className="api-hero-actions">
              <a href="#apply" className="btn btn-primary">
                Apply for Early Access
              </a>
              <a href="#examples" className="btn btn-secondary">
                View API Documentation
              </a>
            </div>
          </div>
        </section>

        {/* Value Prop */}
        <section className="api-section">
          <div className="api-section-inner">
            <h2 className="api-section-title">Why Use the WildPhotography API?</h2>
            <div className="api-value-grid">
              {[
                'Real Costa Rica photography — not AI-generated or stock generic',
                'Verified wildlife and destination imagery with accurate metadata',
                'Keyword-rich metadata included with each photo for SEO and content workflows',
                'Built for automated content workflows — no manual image searching',
                'API access designed for AI agents and travel systems',
                'Safer than relying on generic or AI-generated imagery for travel content',
                'Ideal for SEO pages, articles, newsletters, and social media automation',
                'Reduces recurring manual image sourcing effort',
              ].map((item) => (
                <div key={item} className="api-value-item">
                  <span className="api-value-check">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cost Advantage */}
        <section className="api-section api-section-alt">
          <div className="api-section-inner">
            <h2 className="api-section-title">
              A More Efficient Alternative to Traditional Stock Photography
            </h2>
            <div className="api-cost-content">
              <p>
                Traditional stock image platforms such as Adobe Stock, Shutterstock, Getty
                Images, and similar services are typically designed for manual image discovery
                and per-image licensing workflows. WildPhotography API is designed for
                automated image discovery and programmatic publishing.
              </p>
              <p>
                Instead of manually searching for images every time you create a travel article,
                destination guide, SEO page, newsletter, or AI-generated content workflow, your
                system can retrieve authentic Costa Rica wildlife and travel imagery directly
                through the API.
              </p>
              <div className="api-cost-points">
                {[
                  'Can be more cost-effective than per-image licensing for high-volume use cases',
                  'Reduces manual image sourcing across recurring content production cycles',
                  'Supports automated content workflows without human image selection',
                  'Helps automate image discovery for SEO pages and article automation',
                  'Avoids repetitive stock-photo search workflows',
                ].map((point) => (
                  <div key={point} className="api-cost-point">
                    <span className="api-cost-point-icon">→</span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Plans */}
        <section className="api-section" id="plans">
          <div className="api-section-inner">
            <h2 className="api-section-title">Choose Your Plan</h2>
            <div className="api-plans-grid">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`api-plan-card${plan.highlight ? ' api-plan-highlight' : ''}`}
                >
                  {plan.highlight && <div className="api-plan-badge">Most Popular</div>}
                  <h3 className="api-plan-name">{plan.name}</h3>
                  <div className="api-plan-pricing">
                    <span className="api-plan-launch">
                      ${plan.launchPrice}<span>/mo</span>
                    </span>
                    <span className="api-plan-regular">
                      Regular ${plan.regularPrice}/mo
                    </span>
                  </div>
                  <div className="api-plan-calls">{plan.apiCalls}</div>
                  <ul className="api-plan-features">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <a href="#apply" className={`btn ${plan.highlight ? 'btn-primary' : 'btn-outline'}`}>
                    Get Started
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* API Examples */}
        <section className="api-section api-section-alt" id="examples">
          <div className="api-section-inner">
            <h2 className="api-section-title">API Examples</h2>
            <p className="api-section-sub">
              Query real Costa Rica wildlife and destination photography programmatically.
            </p>
            <div className="api-examples">
              {[
                { label: 'Search toucan photos', code: 'GET /api/v1/search?q=toucan' },
                { label: 'Search scarlet macaw', code: 'GET /api/v1/search?q=scarlet+macaw' },
                { label: 'Search Monteverde location', code: 'GET /api/v1/search?q=monteverde' },
                { label: 'Check your usage', code: 'GET /api/v1/usage' },
              ].map((ex) => (
                <div key={ex.code} className="api-example">
                  <span className="api-example-label">{ex.label}</span>
                  <code className="api-example-code">{ex.code}</code>
                </div>
              ))}
            </div>
            <p className="api-examples-footnote">
              Full API documentation provided upon approval. Base URL:{' '}
              <code>https://api.wildphotography.com/v1</code>
            </p>
          </div>
        </section>

        {/* Application Form */}
        <section className="api-section" id="apply">
          <div className="api-section-inner api-section-narrow">
            <h2 className="api-section-title">Apply for Early Access</h2>
            <p className="api-section-sub">
              Tell us about your use case and we will follow up with API credentials and
              onboarding details.
            </p>
            <ApiAccessForm />
          </div>
        </section>

        {/* FAQ */}
        <section className="api-section api-section-alt" id="faq">
          <div className="api-section-inner">
            <h2 className="api-section-title">Frequently Asked Questions</h2>
            <div className="api-faq-grid">
              {FAQ.map((item) => (
                <div key={item.q} className="api-faq-item">
                  <h3 className="api-faq-q">{item.q}</h3>
                  <p className="api-faq-a">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .api-access-page { font-family: var(--font-body, system-ui, sans-serif); color: var(--ink, #1a1a1a); }

        .api-hero {
          background: linear-gradient(135deg, #0a2540 0%, #1a3a5c 50%, #0d3a2d 100%);
          color: white;
          padding: 80px 24px;
          text-align: center;
        }
        .api-hero-inner { max-width: 720px; margin: 0 auto; }
        .api-hero-badge {
          display: inline-block;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 999px;
          padding: 6px 16px;
          font-size: 12px;
          font-family: var(--font-mono, monospace);
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .api-hero-title {
          font-family: var(--font-display, serif);
          font-size: clamp(1.8rem, 4vw, 2.8rem);
          font-weight: 500;
          line-height: 1.15;
          margin: 0 0 20px;
        }
        .api-hero-sub {
          font-size: 17px;
          line-height: 1.7;
          color: rgba(255,255,255,0.8);
          margin: 0 0 32px;
        }
        .api-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }

        .api-section { padding: 64px 24px; }
        .api-section-alt { background: rgba(0,0,0,0.03); }
        .api-section-inner { max-width: 960px; margin: 0 auto; }
        .api-section-narrow { max-width: 600px; }
        .api-section-title {
          font-family: var(--font-display, serif);
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 500;
          margin: 0 0 16px;
          color: var(--ink, #1a1a1a);
        }
        .api-section-sub {
          font-size: 16px;
          color: var(--ink-muted, #666);
          margin: -8px 0 32px;
          line-height: 1.6;
        }

        .api-value-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 24px; }
        .api-value-item { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.5; }
        .api-value-check { color: #16a34a; font-weight: 700; flex-shrink: 0; }

        .api-cost-content p { font-size: 16px; line-height: 1.75; color: var(--ink-muted, #666); margin: 0 0 16px; }
        .api-cost-points { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
        .api-cost-point { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; }
        .api-cost-point-icon { color: var(--accent, #2e7d32); flex-shrink: 0; }

        .api-plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; margin-top: 24px; }
        .api-plan-card {
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 16px;
          padding: 28px 24px;
          background: white;
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
        }
        .api-plan-highlight { border-color: var(--accent, #2e7d32); box-shadow: 0 0 0 1px var(--accent, #2e7d32); }
        .api-plan-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent, #2e7d32);
          color: white;
          font-size: 11px;
          font-family: var(--font-mono, monospace);
          letter-spacing: .05em;
          padding: 4px 12px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .api-plan-name { font-size: 17px; font-weight: 600; margin: 0 0 12px; }
        .api-plan-pricing { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
        .api-plan-launch { font-size: 28px; font-weight: 700; color: var(--ink, #1a1a1a); }
        .api-plan-launch span { font-size: 14px; font-weight: 400; color: var(--ink-muted, #666); }
        .api-plan-regular { font-size: 12px; color: var(--ink-muted, #666); text-decoration: line-through; }
        .api-plan-calls { font-size: 13px; font-family: var(--font-mono, monospace); color: var(--accent, #2e7d32); margin-bottom: 16px; }
        .api-plan-features { list-style: none; padding: 0; margin: 0 0 20px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .api-plan-features li { font-size: 13px; line-height: 1.5; color: var(--ink-muted, #666); padding-left: 16px; position: relative; }
        .api-plan-features li::before { content: '·'; position: absolute; left: 0; color: var(--accent, #2e7d32); font-weight: 700; }

        .api-examples { display: flex; flex-direction: column; gap: 12px; margin-top: 24px; }
        .api-example { display: flex; flex-direction: column; gap: 4px; }
        .api-example-label { font-size: 13px; color: var(--ink-muted, #666); }
        .api-example-code {
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          background: rgba(0,0,0,0.06);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          padding: 10px 16px;
          display: block;
          color: var(--ink, #1a1a1a);
        }
        .api-examples-footnote { font-size: 14px; color: var(--ink-muted, #666); margin-top: 16px; }
        .api-examples-footnote code { font-family: var(--font-mono, monospace); background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; }

        .api-faq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; margin-top: 24px; }
        .api-faq-item { display: flex; flex-direction: column; gap: 8px; }
        .api-faq-q { font-size: 15px; font-weight: 600; margin: 0; color: var(--ink, #1a1a1a); }
        .api-faq-a { font-size: 14px; line-height: 1.65; color: var(--ink-muted, #666); margin: 0; }

        /* Buttons */
        .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 500; text-decoration: none; cursor: pointer; transition: all .2s; border: none; }
        .btn-primary { background: var(--accent, #2e7d32); color: white; }
        .btn-primary:hover { background: #1b5e20; }
        .btn-secondary { background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); }
        .btn-secondary:hover { background: rgba(255,255,255,0.25); }
        .btn-outline { background: transparent; color: var(--ink, #1a1a1a); border: 1px solid rgba(0,0,0,0.2); }
        .btn-outline:hover { border-color: var(--accent, #2e7d32); color: var(--accent, #2e7d32); }

        @media (max-width: 600px) {
          .api-hero { padding: 56px 20px; }
          .api-plans-grid { grid-template-columns: 1fr; }
          .api-faq-grid { grid-template-columns: 1fr; }
          .api-value-grid { grid-template-columns: 1fr; }
          .api-hero-actions { flex-direction: column; align-items: center; }
          .api-hero-actions .btn { width: 100%; max-width: 280px; text-align: center; }
        }
      `}</style>
    </>
  );
}