import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from './providers';
import './globals.css';

// ClerkProvider validates its publishable key eagerly on render, so every
// page — even ones that don't touch Clerk hooks — needs a live request
// context rather than being statically prerendered at build time.
export const dynamic = 'force-dynamic';

// Same font, same loading strategy, same CSS variable name as
// apps/catering-system/src/app/layout.tsx — kept identical so the two apps
// are visually indistinguishable in typography, not just in color tokens.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#3b3030',
};

export const metadata: Metadata = {
  title: "Abby's Caterers — Admin Portal",
  description: 'RFQ, proforma, invoice, and reporting control plane for Abby\'s Legendary Caterers.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "Abby's Admin",
  },
  icons: {
    apple: '/icons/apple-touch-icon-180x180.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} antialiased font-sans bg-background`}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
