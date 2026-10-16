import type { Metadata, Viewport } from 'next';
import { RegisterServiceWorker } from '@/components/register-sw';
import './globals.css';

export const metadata: Metadata = {
  title: "Abby's Attendance",
  description: "Clock in and out by face at Abby's Caterers sites.",
  manifest: '/manifest.webmanifest',
  applicationName: "Abby's Attendance",
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#3B3030',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
