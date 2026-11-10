import type { Metadata, Viewport } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#101827',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Switchboard — AI Front Desk for Modern Businesses',
  description:
    'Switchboard gives your business AI assistants that answer customers, manage bookings, capture leads, and complete approved tasks—without losing the human touch.',
  metadataBase: new URL('https://switchboard-bm.vercel.app'),
  openGraph: {
    title: 'Switchboard — AI Front Desk for Modern Businesses',
    description:
      'Your business never stops. Neither should your front desk. AI assistants with deterministic booking and Kora payments.',
    siteName: 'Switchboard',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Switchboard — AI Front Desk for Modern Businesses',
    description:
      'Your business never stops. Neither should your front desk. AI assistants with deterministic booking and Kora payments.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background font-body-md text-body-md text-on-surface antialiased selection:bg-primary-container selection:text-white">
        {children}
      </body>
    </html>
  );
}
