import { Metadata } from "next";
import SiteFooter from "@/components/editorial/SiteFooter";
import Masthead from "@/components/editorial/Masthead";

const SITE_URL = "https://wildphotography.com";

export const metadata: Metadata = {
  title: "Prints & Licensing | Wildphotography",
  description:
    "Limited-edition archival prints and high-resolution licensing coming soon to Wildphotography.",
  alternates: {
    canonical: `${SITE_URL}/prints`,
  },
  openGraph: {
    title: "Prints & Licensing | Wildphotography",
    description:
      "Limited-edition archival prints and high-resolution licensing coming soon.",
    url: `${SITE_URL}/prints`,
  },
};

export default function PrintsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ink)",
      }}
    >
      <Masthead />
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--gutter) var(--gutter)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "540px" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: "24px",
            }}
          >
            Archival Prints & Licensing
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(48px, 8vw, 80px)",
              fontWeight: 700,
              lineHeight: 1.05,
              color: "var(--paper)",
              marginBottom: "24px",
            }}
          >
            Coming Soon.
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              lineHeight: 1.7,
              color: "var(--ink-dim)",
              marginBottom: "40px",
            }}
          >
            Fine-art prints from Costa Rica's most dramatic coastlines, cloud
            forests, and wildlife encounters are being prepared for release.
            High-resolution licensing for editorial and commercial use is also in
            the works.
          </p>
          <a
            href="/search"
            style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
              borderRadius: "var(--r-sm)",
              padding: "12px 28px",
              textDecoration: "none",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            Browse the Archive →
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
