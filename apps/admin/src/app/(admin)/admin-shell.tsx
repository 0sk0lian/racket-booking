'use client';

import { Sidebar } from './sidebar';
import { GlobalSearch } from '../../components/GlobalSearch';
import { NotificationBell } from '../../components/NotificationBell';

export function AdminShell({ children }: { children: React.ReactNode }) {
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
