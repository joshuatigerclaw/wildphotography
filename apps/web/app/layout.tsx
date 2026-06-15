import './styles/editorial/tokens.css';
import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import Masthead from '@/components/editorial/Masthead';
import SiteFooter from '@/components/editorial/SiteFooter';

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
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-EPPFTRYF92" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-EPPFTRYF92');
          `}
        </Script>
        {/* GetYourGuide Widget */}
        <Script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="6ZV7KMH" />
      </head>
      <body>
        <Masthead />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}