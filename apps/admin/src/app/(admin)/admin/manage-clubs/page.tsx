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
    adminEmail: '',
  });
  const [inviteResult, setInviteResult] = useState<{ tempPassword?: string; email?: string } | null>(null);

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
    setInviteResult(null);

    // 1. Create the club
    const response = await fetch(`${API}/clubs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClub),
    }).then((r) => r.json());

    if (!response.success) {
      setBusy(false);
      return setToast(response.error ?? 'Could not create venue');
    }

    const clubId = response.data.id;

    // 2. If admin email provided, invite them
    if (newClub.adminEmail.trim()) {
      const inviteResponse = await fetch(`${API}/admin/invite-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newClub.adminEmail.trim(), clubId }),
      }).then((r) => r.json());

      if (inviteResponse.success && inviteResponse.data?.tempPassword) {
        setInviteResult({
          tempPassword: inviteResponse.data.tempPassword,
          email: inviteResponse.data.email,
        });
      } else if (!inviteResponse.success) {
        setToast(`Venue created but admin invite failed: ${inviteResponse.error}`);
      }
    }

    setBusy(false);
    setNewClub({ name: '', city: '', organizationNumber: '', timezone: 'Europe/Stockholm', adminEmail: '' });
    await load();
    if (!inviteResult) setToast('Venue created');
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
            <input value={newClub.name} onChange={(e) => setNewClub((prev) => ({ ...prev, name: e.target.value }))} placeholder="Namn" style={inputStyle} />
            <input value={newClub.city} onChange={(e) => setNewClub((prev) => ({ ...prev, city: e.target.value }))} placeholder="Stad" style={inputStyle} />
            <input value={newClub.organizationNumber} onChange={(e) => setNewClub((prev) => ({ ...prev, organizationNumber: e.target.value }))} placeholder="Org.nr" style={inputStyle} />
            <input value={newClub.timezone} onChange={(e) => setNewClub((prev) => ({ ...prev, timezone: e.target.value }))} placeholder="Timezone" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input value={newClub.adminEmail} onChange={(e) => setNewClub((prev) => ({ ...prev, adminEmail: e.target.value }))} placeholder="Admin email (valfritt — bjuder in som admin)" style={inputStyle} type="email" />
            <button className="btn btn-primary" onClick={createClub} disabled={busy || !newClub.name.trim()}>
              {busy ? 'Skapar...' : 'Skapa venue'}
            </button>
          </div>
        </div>
      )}
      {inviteResult?.tempPassword && (
        <div style={{ marginBottom: 14, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 6 }}>Admin-konto skapat</div>
          <div style={{ fontSize: 13, color: '#15803d', marginBottom: 4 }}>
            E-post: <strong>{inviteResult.email}</strong>
          </div>
          <div style={{ fontSize: 13, color: '#15803d', marginBottom: 8 }}>
            Engångslösenord: <code style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 15 }}>{inviteResult.tempPassword}</code>
          </div>
          <div style={{ fontSize: 11, color: '#166534' }}>
            Skicka detta till adminen. De måste byta lösenord vid första inloggningen.
          </div>
          <button onClick={() => setInviteResult(null)} style={{ marginTop: 8, fontSize: 11, color: '#166534', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Stäng</button>
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
