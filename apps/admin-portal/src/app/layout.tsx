import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from './providers';
import './globals.css';

// ClerkProvider validates its publishable key eagerly on render, so every
// page — even ones that don't touch Clerk hooks — needs a live request
// context rather than being statically prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Abby's Caterers — Admin Portal",
  description: 'RFQ, proforma, invoice, and reporting control plane for Abby\'s Legendary Caterers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
