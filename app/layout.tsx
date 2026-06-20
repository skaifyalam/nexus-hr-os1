import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NEXUS HR — Enterprise Workforce Platform',
  description: 'AI-powered HR, recruitment, and workforce intelligence platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
