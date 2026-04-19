'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Membership { id: string; club_id: string; status: string; membership_type: string; applied_at: string; approved_at: string | null; }

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Väntar', bg: '#fef3c7', color: '#b45309' },
  active: { label: 'Aktiv', bg: '#ecfdf5', color: '#059669' },
  suspended: { label: 'Pausad', bg: '#fef2f2', color: '#dc2626' },
  cancelled: { label: 'Avslutad', bg: '#f1f5f9', color: '#64748b' },
};

export default function MyMembershipsPage() {
  const [memberships, setMemberships] = useState<(Membership & { club_name?: string; club_city?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users/me/memberships')
      .then(r => r.json())
      .then(r => {
        setMemberships(r.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mina medlemskap</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Klubbar du är medlem i eller ansökt till.</p>

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : memberships.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>🏢</p>
          <h3 style={{ color: '#334155' }}>Inga medlemskap</h3>
          <p>Besök en anläggning och ansök om medlemskap.</p>
          <Link href="/clubs" style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>Hitta anläggningar</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memberships.map(m => {
            const s = STATUS[m.status] ?? STATUS.pending;
            return (
              <Link key={m.id} href={`/clubs/${m.club_id}/membership`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{m.club_name ?? 'Klubb'}</h3>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{m.club_city ?? 'Sverige'} · {m.membership_type}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Ansökt {new Date(m.applied_at).toLocaleDateString('sv-SE')}
                    {m.approved_at && ` · Godkänd ${new Date(m.approved_at).toLocaleDateString('sv-SE')}`}
                  </div>
                </div>
                <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
