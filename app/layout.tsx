import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Naibus — Intelligence Behind Every Business',
  description: 'Naibus: intelligent HR and business operating system — unify people, processes, and data on one platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
