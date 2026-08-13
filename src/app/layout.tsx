import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Cricket Auction 2026',
  description: 'Live cricket auction console, team registration, and captain assignments.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <Navbar />
        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
