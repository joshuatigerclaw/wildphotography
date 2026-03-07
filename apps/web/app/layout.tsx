import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wildphotography - Premium Costa Rica Nature Photography',
  description: 'Professional wildlife and nature photography from Costa Rica. Prints, licensing, and guided photography tours.',
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
            <a href="/" className="text-2xl font-bold text-primary-600">
              Wildphotography
            </a>
            <div className="flex gap-6">
              <a href="/galleries" className="hover:text-primary-600">Galleries</a>
              <a href="/shop" className="hover:text-primary-600">Shop</a>
              <a href="/about" className="hover:text-primary-600">About</a>
              <a href="/contact" className="hover:text-primary-600">Contact</a>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t mt-16">
          <div className="container mx-auto px-4 py-8">
            <p className="text-center text-gray-500">
              © {new Date().getFullYear()} Wildphotography. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
