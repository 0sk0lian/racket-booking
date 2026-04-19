'use client';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
const API = '/api';

export default function ManageClubsPage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [newClub, setNewClub] = useState({
    name: '',
    city: '',
    organizationNumber: '',
    timezone: 'Europe/Stockholm',
  });

  const setToast = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(''), 3500);
  };

  const load = async () => {
    setLoading(true);
    const [clubsResponse, meResponse] = await Promise.all([
      fetch(`${API}/clubs`).then((r) => r.json()),
      fetch(`${API}/users/me`).then((r) => r.json()),
    ]);
    setClubs(clubsResponse.data ?? []);
    setIsSuperadmin(Boolean(meResponse?.data?.is_superadmin));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const createClub = async () => {
    if (!newClub.name.trim()) return;
    setBusy(true);
    const response = await fetch(`${API}/clubs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClub),
    }).then((r) => r.json());
    setBusy(false);

    if (!response.success) return setToast(response.error ?? 'Could not create venue');

    setNewClub({ name: '', city: '', organizationNumber: '', timezone: 'Europe/Stockholm' });
    await load();
    setToast('Venue created');
  };

  return (
    <div>
      <div className="page-header"><h1>Alla Klubbar</h1></div>
      {flash && (
        <div style={{ marginBottom: 12, borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontSize: 12, fontWeight: 600, padding: '10px 14px' }}>
          {flash}
        </div>
      )}
      {isSuperadmin && (
        <div style={{ marginBottom: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 14 }}>Skapa ny venue</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <input value={newClub.name} onChange={(e) => setNewClub((prev) => ({ ...prev, name: e.target.value }))} placeholder="Namn" style={inputStyle} />
            <input value={newClub.city} onChange={(e) => setNewClub((prev) => ({ ...prev, city: e.target.value }))} placeholder="Stad" style={inputStyle} />
            <input value={newClub.organizationNumber} onChange={(e) => setNewClub((prev) => ({ ...prev, organizationNumber: e.target.value }))} placeholder="Org.nr" style={inputStyle} />
            <input value={newClub.timezone} onChange={(e) => setNewClub((prev) => ({ ...prev, timezone: e.target.value }))} placeholder="Timezone" style={inputStyle} />
            <button className="btn btn-primary" onClick={createClub} disabled={busy || !newClub.name.trim()}>
              Skapa
            </button>
          </div>
        </div>
      )}
      {loading ? <div className="loading">Laddar...</div> : clubs.length === 0 ? (
        <div className="empty-state"><h3>Inga klubbar</h3></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clubs.map(c => (
            <Link key={c.id} href={`/admin/manage-clubs/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.city ?? 'Sverige'} | {c.organization_number}</div>
              </div>
              <div style={{ fontSize: 12, color: c.is_non_profit ? '#059669' : 'var(--text-dim)' }}>{c.is_non_profit ? 'Ideell' : 'Kommersiell'}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 12,
  fontFamily: 'inherit',
};
