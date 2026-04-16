import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Racket Booking',
  description: 'Boka padel, tennis och squash — Sveriges bokningsplattform för racketsporter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
