'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
const API = '/api';

export default function ManageClubsPage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data ?? []); setLoading(false); });
  }, []);

  return (
    <div>
      <div className="page-header"><h1>Alla Klubbar</h1></div>
      {loading ? <div className="loading">Laddar...</div> : clubs.length === 0 ? (
        <div className="empty-state"><h3>Inga klubbar</h3></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clubs.map(c => (
            <Link key={c.id} href={`/admin/manage-clubs/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.city ?? 'Sverige'} · {c.organization_number}</div>
              </div>
              <div style={{ fontSize: 12, color: c.is_non_profit ? '#059669' : 'var(--text-dim)' }}>{c.is_non_profit ? 'Ideell' : 'Kommersiell'}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
