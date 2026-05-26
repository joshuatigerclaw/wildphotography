"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
          className="flex items-center gap-2.5 rounded-lg bg-blue-600/20 px-3 py-2.5 text-sm font-medium text-blue-400"
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

function RuleCard({ number, title, description, steps, warning }: {
  number: string; title: string; description: string; steps: string[]; warning?: string;
}) {
  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{number}</span>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="mt-2 text-sm text-gray-400">{description}</p>
      </div>
      <div className="px-6 py-4">
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs text-gray-500">{i + 1}</span>
              <span className="font-mono text-xs text-blue-300" dangerouslySetInnerHTML={{ __html: step.replace(/`(.*?)`/g, '<code class="bg-gray-800 rounded px-1.5 py-0.5 text-blue-200">$1</code>') }} />
            </li>
          ))}
        </ol>
        {warning && (
          <div className="mt-4 rounded-lg border border-yellow-900/50 bg-yellow-950/20 px-4 py-3">
            <p className="text-xs text-yellow-300">⚠️ {warning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CloudflareRulesPage() {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar pathname={pathname} />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Cloudflare Security Rules</h1>
          <p className="mt-1 text-sm text-gray-500">Manual setup instructions for Cloudflare Dashboard — deploy these alongside Phase 5</p>
          <div className="mt-3 flex gap-3">
            <Link href="/admin/security" className="text-xs text-blue-400 hover:underline">← Security Dashboard</Link>
            <span className="text-gray-700">|</span>
            <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">Open Cloudflare Dashboard →</a>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-blue-900/30 bg-blue-950/20 p-4">
          <p className="text-sm text-blue-200">
            <strong>Prerequisite:</strong> Log in to <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="underline">dash.cloudflare.com</a> and select your <strong>wildphotography.com</strong> domain before starting.
          </p>
        </div>

        <RuleCard
          number="1"
          title="Enable Bot Fight Mode"
          description="Automatically challenge detected bots and suspicious traffic across the entire site."
          steps={[
            "Go to Security → Bots",
            "Find <code>Bot Fight Mode</code> and toggle it <code>ON</code>",
            "Optionally enable <code>Verified Bot Checks</code> to allow legitimate crawlers (Google, Bing)",
            "Save changes",
          ]}
          warning="Verified bots (Googlebot, Bingbot) will still pass through. This only challenges unrecognized automated traffic."
        />

        <RuleCard
          number="2"
          title="General API Rate Limiting — 60 req/min per IP"
          description="Protect all /api/ routes from high-volume abuse. Applied to every API endpoint not already cached."
          steps={[
            "Go to Security → WAF → Rate Limiting",
            "Click <code>Create Rule</code>",
            "Name: <code>General API Rate Limit</code>",
            "Expression builder: <code>(http.request.uri.path contains \"/api/\")</code>",
            "Under <code>Rate</code>: set <code>60 requests per minute</code> per <code>IP address</code>",
            "Under <code>Action</code>: select <code>Managed Challenge</code>",
            "Under <code>Bypass</code>: add <code>cf.bot_management.verified_bot = true</code> (so good bots aren't challenged)",
            "Save and deploy",
          ]}
        />

        <RuleCard
          number="3"
          title="Search API Rate Limiting — 30 req/min per IP"
          description="Search endpoints are more expensive. Tighten the limit specifically for /api/search, /api/public/search, and /api/v1/search."
          steps={[
            "Go to Security → WAF → Rate Limiting",
            "Click <code>Create Rule</code>",
            "Name: <code>Search API Rate Limit</code>",
            "Expression: <code>(http.request.uri.path contains \"/api/search\" or http.request.uri.path contains \"/api/v1/search\")</code>",
            "Rate: <code>30 requests per minute</code> per <code>IP address</code>",
            "Action: <code>Managed Challenge</code>",
            "Save and deploy",
          ]}
        />

        <RuleCard
          number="4"
          title="Photo Page Rate Limiting — 120 req/min per IP"
          description="Individual photo pages can be crawled heavily. Set a higher threshold that still stops abuse."
          steps={[
            "Go to Security → WAF → Rate Limiting",
            "Click <code>Create Rule</code>",
            "Name: <code>Photo Page Rate Limit</code>",
            "Expression: <code>(http.request.uri.path contains \"/photo/\")</code>",
            "Rate: <code>120 requests per minute</code> per <code>IP address</code>",
            "Action: <code>Managed Challenge</code>",
            "Save and deploy",
          ]}
        />

        <RuleCard
          number="5"
          title="Block Known Bad User Agents"
          description="Reject or challenge requests with obvious scraping tool user agents. Use Managed Challenge first to avoid false positives."
          steps={[
            "Go to Security → WAF → Custom Rules",
            "Click <code>Create Rule</code>",
            "Name: <code>Block Bad User Agents</code>",
            "Expression: <code>(http.user_agent contains \"curl\" or http.user_agent contains \"python-requests\" or http.user_agent contains \"aiohttp\" or http.user_agent contains \"scrapy\" or http.user_agent contains \"wget\" or http.user_agent contains \"okhttp\" or http.user_agent contains \"headless\" or http.user_agent contains \"selenium\" or http.user_agent contains \"playwright\" or http.user_agent contains \"puppeteer\")</code>",
            "Action: <code>Managed Challenge</code>",
            "Save and deploy",
          ]}
          warning="Some CMS integrations and CI tools use these UAs. Monitor for false positives in the Security Dashboard after enabling."
        />

        <RuleCard
          number="6"
          title="Challenge Suspicious Singapore API Traffic"
          description="High volumes of API abuse have been observed from Singapore ASNs. Challenge these requests for human verification."
          steps={[
            "Go to Security → WAF → Custom Rules",
            "Click <code>Create Rule</code>",
            "Name: <code>Challenge Singapore API Traffic</code>",
            "Expression: <code>(ip.geoip.country eq \"SG\" and http.request.uri.path contains \"/api/\")</code>",
            "Action: <code>Managed Challenge</code>",
            "Save and deploy",
          ]}
          warning="If you have legitimate users in Singapore, monitor for false positives. Consider changing to Block after 1 week if no legitimate traffic is affected."
        />

        <RuleCard
          number="7"
          title="Image Hotlink Protection"
          description="Block or challenge requests to image derivative URLs (/large/, /thumbs/) when the referer is absent or not wildphotography.com."
          steps={[
            "Go to Security → WAF → Custom Rules",
            "Click <code>Create Rule</code>",
            "Name: <code>Image Hotlink Protection</code>",
            "Expression: <code>(http.request.uri.path contains \"/large/\" or http.request.uri.path contains \"/thumbs/\" or http.request.uri.path contains \"/web_\") and (not http.referer contains \"wildphotography.com\" and not http.referer contains \"google.com\" and not http.referer contains \"facebook.com\" and not http.referer contains \"t.co\")</code>",
            "Action: <code>Managed Challenge</code>",
            "Save and deploy",
          ]}
          warning="Google Images, Twitter/X embeds, and Facebook sharing previews use image derivatives. The bypass for google.com, facebook.com, and t.co prevents those from breaking. Review after 24h."
        />

        <RuleCard
          number="8"
          title="ASN Challenge Rules (If Needed)"
          description="After reviewing the /admin/security dashboard, create ASN-level rules for ASNs showing high-volume non-human traffic."
          steps={[
            "Go to Security → WAF → Custom Rules",
            "Click <code>Create Rule</code>",
            "Name: <code>Block High-Volume ASN</code>",
            "Use the ASN identified from the Security Dashboard, e.g.: <code>(ip.geoip.asn eq 138994)</code>",
            "You can combine: <code>(ip.geoip.asn eq 138994 and http.request.uri.path contains \"/api/\")</code>",
            "Action: <code>Managed Challenge</code> (or <code>Block</code> if confirmed abusive)",
            "Save and deploy",
          ]}
        />

        <RuleCard
          number="9"
          title="DDoS Sensitivity — Medium/High"
          description="Enable Cloudflare DDoS protection at Medium sensitivity. This activates automatically under attack but won't affect normal traffic."
          steps={[
            "Go to Security → DDoS",
            "Under <code>ADS (Advanced DDoS)</code> or <code>Layer 7 DDoS Protection</code>, set sensitivity to <code>Medium</code>",
            "Enable <code>Browser Integrity Check</code> (under Security → Settings)",
            "For highest protection: go to Security → Settings → Challenge Passages and set <code>Seconds to stay on challenge page: 10</code>",
            "Save",
          ]}
          warning="Only enable High sensitivity if you are actively under attack. High sensitivity may generate more false positives for mobile users on flaky connections."
        />

        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Expected Request Reduction</h2>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              { label: "Bot Fight Mode", est: "~5-15% of automated traffic" },
              { label: "General API Rate Limit", est: "~10-20% abuse traffic" },
              { label: "Search Rate Limit", est: "~5-10% of search abuse" },
              { label: "Bad UA Block", est: "~5-10% obvious scrapers" },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-gray-800 p-4">
                <div className="text-sm font-medium text-gray-300">{item.label}</div>
                <div className="mt-1 text-xs text-green-400">{item.est}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded border border-green-900/50 bg-green-950/20 p-4">
            <div className="text-sm font-semibold text-green-300">Combined estimated reduction: 30-50% of total unwanted requests</div>
            <div className="mt-1 text-xs text-gray-500">Worker-level bot scoring + Dashboard WAF rules together provide defense-in-depth.</div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">Verification After Setup</h2>
          <ol className="space-y-2 text-sm text-gray-400">
            <li>1. Wait 5 minutes for rules to propagate</li>
            <li>2. Check <Link href="/admin/security" className="text-blue-400 hover:underline">Security Dashboard</Link> — blocked/challenged counts should start rising</li>
            <li>3. Monitor for 24h — check the Recent Security Events table for false positives</li>
            <li>4. If legitimate traffic is being challenged, add a bypass rule for that IP range or UA pattern</li>
            <li>5. Adjust rate limits up/down based on observed traffic patterns</li>
          </ol>
        </div>
      </main>
    </div>
  );
}