'use client';

import { useEffect } from 'react';
import { Sidebar } from './sidebar';
import { GlobalSearch } from '../../components/GlobalSearch';
import { NotificationBell } from '../../components/NotificationBell';

export function AdminShell({ children }: { children: React.ReactNode }) {
  // Apply saved theme on mount so it takes effect before Sidebar renders
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '12px 44px 0 44px',
          gap: 10,
        }}>
          <NotificationBell />
        </div>
        <main className="main" style={{ flex: 1 }}>{children}</main>
      </div>
      <GlobalSearch />
    </div>
  );
}
