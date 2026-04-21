'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { GlobalSearch } from '../../components/GlobalSearch';
import { NotificationBell } from '../../components/NotificationBell';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [userName, setUserName] = useState<string | undefined>();

  useEffect(() => {
    // Apply saved theme
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.dataset.theme = saved;
    }

    // Fetch user role for sidebar visibility
    fetch('/api/users/me').then(r => r.json()).then(r => {
      if (r.data) {
        setIsSuperadmin(r.data.role === 'superadmin');
        setUserName(r.data.full_name ?? r.data.email ?? undefined);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="layout">
      <Sidebar isSuperadmin={isSuperadmin} userName={userName} />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
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
