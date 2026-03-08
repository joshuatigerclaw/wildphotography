import './globals.css';
import type { Metadata } from 'next';

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
              <a href="/search" className="hover:text-blue-600 transition">
                Search
              </a>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t mt-16">
          <div className="container mx-auto px-4 py-8 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Wildphotography. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
