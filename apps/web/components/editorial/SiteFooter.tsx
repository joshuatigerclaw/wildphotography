import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500 }}>
              WildPhotography
            </div>
            <p>
              Professional Costa Rica wildlife photography. All images available as limited-edition archival prints or high-resolution digital downloads.
            </p>
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            <ul>
              <li><Link href="/galleries">Galleries</Link></li>
              <li><Link href="/species">Species</Link></li>
              <li><Link href="/region">Regions</Link></li>
              <li><Link href="/map">Map</Link></li>
              <li><Link href="/search">Search</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Shop</h4>
            <ul>
              <li><Link href="/prints">Prints</Link></li>
              <li><Link href="/article/quetzal-photography-guide">Quetzal Guide</Link></li>
              <li><Link href="/article/macaw-photography-guide">Macaw Guide</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>About</h4>
            <ul>
              <li><Link href="/about">About</Link></li>
              <li><a href="mailto:josh@wildphotography.com">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} WildPhotography. All rights reserved.</span>
          <span>Costa Rica · {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}