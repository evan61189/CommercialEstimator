import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Preconstruction AI Command Center',
  description: 'Real-time monitoring dashboard for preconstruction AI agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-slate-800 bg-slate-950 px-6 py-3 flex gap-6 text-sm">
          <Link href="/" className="text-slate-200 hover:text-white font-medium">Dashboard</Link>
          <Link href="/reviews" className="text-slate-200 hover:text-white font-medium">Review Queue</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
