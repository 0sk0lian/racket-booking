import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from './sidebar';

export const metadata: Metadata = {
  title: 'Racket Booking — Admin',
  description: 'Club management portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <div className="layout">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
