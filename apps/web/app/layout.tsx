import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Wildphotography | Costa Rica Nature Photography',
  description: 'Professional wildlife and nature photography from Costa Rica. Explore our galleries, purchase prints, or book a photography tour.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics */}
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-EPPFTRYF92" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-EPPFTRYF92');
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-white text-gray-900">
        <header className="border-b">
          <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold">
              Wildphotography
            </a>
            <div className="flex gap-6">
              <a href="/galleries" className="hover:text-blue-600 transition">
                Galleries
              </a>
              <a href="/species" className="hover:text-blue-600 transition">
                Species
              </a>
              <a href="/region" className="hover:text-blue-600 transition">
                Regions
              </a>
              <a href="/article" className="hover:text-blue-600 transition font-medium">
                Articles
              </a>
              <a href="/search" className="hover:text-blue-600 transition">
                Search
              </a>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-gray-500 text-sm">
                © {new Date().getFullYear()} Wildphotography. All rights reserved.
              </div>
              <nav className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
                <a href="/galleries" className="hover:text-blue-600 transition">Galleries</a>
                <a href="/species" className="hover:text-blue-600 transition">Species</a>
                <a href="/region" className="hover:text-blue-600 transition">Regions</a>
                <a href="/article" className="hover:text-blue-600 transition">Articles</a>
                <a href="/search" className="hover:text-blue-600 transition">Search</a>
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
