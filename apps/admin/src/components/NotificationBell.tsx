'use client';
/**
 * NotificationBell — sits in the admin sidebar header. Shows unread count
 * and a dropdown with pending action items linking to relevant pages.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface NotifItem { type: string; label: string; count: number; href: string; color: string; }

export function NotificationBell({ clubId }: { clubId: string }) {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    fetch(`/api/admin/notifications?clubId=${clubId}`)
      .then(r => r.json())
      .then(r => {
        setItems(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch(() => {});
    // Refresh every 60s
    const interval = setInterval(() => {
      fetch(`/api/admin/notifications?clubId=${clubId}`)
        .then(r => r.json())
        .then(r => { setItems(r.data?.items ?? []); setTotal(r.data?.total ?? 0); })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [clubId]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
          fontSize: 18, position: 'relative', borderRadius: 8,
          color: total > 0 ? 'var(--text)' : 'var(--text-dim)',
        }}
        title={total > 0 ? `${total} saker behöver uppmärksamhet` : 'Inga notiser'}
      >
        🔔
        {total > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, borderRadius: 8,
            background: '#ef4444', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{total > 9 ? '9+' : total}</span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 300, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Notiser {total > 0 && `(${total})`}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>Allt under kontroll!</div>
            ) : (
              items.map(item => (
                <Link
                  key={item.type}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                    borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit',
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.count}</span>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
