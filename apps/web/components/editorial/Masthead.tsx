"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/galleries", label: "Galleries" },
  { href: "/species", label: "Species" },
  { href: "/region", label: "Regions" },
  { href: "/map", label: "Map" },
  { href: "/article", label: "Articles" },
  { href: "/prints", label: "Prints" },
];

export default function Masthead() {
  const pathname = usePathname();

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href="/" className="masthead-logo">
          WildPhotography
        </Link>

        <nav className="masthead-nav">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link key={link.href} href={link.href} className={isActive ? "active" : ""}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="masthead-actions">
          <Link href="/search" className="btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }}>
            🔍 Search
          </Link>
        </div>
      </div>
    </header>
  );
}