import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fisi Ai',
  description: 'AI business partner for merchants with WhatsApp-powered stock tracking and sales insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
