'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/my-sessions', label: 'Mina Pass', icon: 'P', color: '#6366f1' },
  { href: '/trainer-schedule', label: 'Schema', icon: 'S', color: '#06b6d4' },
  { href: '/attendance', label: 'Närvaro', icon: 'N', color: '#10b981' },
  { href: '/profile', label: 'Min Profil', icon: 'M', color: '#8b5cf6' },
];

export function TrainerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ full_name?: string; email?: string } | null>(null);

  useEffect(() => {
    fetch('/api/users/me').then(r => r.json()).then(r => {
      if (r.data) setUser({ full_name: r.data.full_name, email: r.data.email });
    }).catch(() => {});
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'TR';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '1px 0 8px rgba(0,0,0,0.03)',
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px 20px',
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: -0.5,
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Racket Booking
        </div>

        <div style={{
          padding: '0 12px 8px',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}>
          Tranavy
        </div>

        {/* Nav items */}
        <nav>
          <ul style={{ listStyle: 'none', padding: '0 10px' }}>
            {navItems.map(n => {
              const active = isActive(n.href);
              return (
                <li key={n.href} style={{ marginBottom: 2 }}>
                  <Link href={n.href} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? '#fff' : 'var(--text-muted)',
                    background: active ? 'var(--accent-gradient)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <span style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: active ? 'rgba(255,255,255,0.2)' : `${n.color}10`,
                      color: active ? '#fff' : n.color,
                      transition: 'all 0.2s',
                    }}>
                      {n.icon}
                    </span>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section at bottom */}
        <div style={{
          marginTop: 'auto',
          padding: '16px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {user?.full_name ?? 'Tranare'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tranare</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        padding: '32px 36px',
        maxWidth: 1200,
        animation: 'fadeIn 0.4s ease',
      }}>
        {children}
      </main>
    </div>
  );
}
