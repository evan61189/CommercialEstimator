import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Preconstruction AI Command Center',
  description: 'Real-time monitoring dashboard for preconstruction AI agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">{children}</body>
    </html>
  );
}
