'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
const API = '/api';

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<any>(null);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/clubs`).then(r => r.json()),
      fetch(`${API}/courts?clubId=${id}`).then(r => r.json()),
    ]).then(([c, co]) => {
      setClub((c.data ?? []).find((x: any) => x.id === id) ?? null);
      setCourts(co.data ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="loading">Laddar...</div>;
  if (!club) return <div className="empty-state"><h3>Klubb hittades inte</h3><Link href="/admin/manage-clubs" style={{ color: '#6366f1' }}>Tillbaka</Link></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/admin/manage-clubs" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>← Alla klubbar</Link>
          <h1 style={{ marginTop: 4 }}>{club.name}</h1>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <InfoCard label="Org.nummer" value={club.organization_number} />
        <InfoCard label="Stad" value={club.city ?? '—'} />
        <InfoCard label="E-post" value={club.contact_email ?? '—'} />
        <InfoCard label="Telefon" value={club.contact_phone ?? '—'} />
        <InfoCard label="Typ" value={club.is_non_profit ? 'Ideell förening' : 'Kommersiell'} />
        <InfoCard label="Tidszon" value={club.timezone ?? 'Europe/Stockholm'} />
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Banor ({courts.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courts.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8, textTransform: 'capitalize' }}>{c.sport_type} · {c.is_indoor ? 'Inomhus' : 'Utomhus'}</span>
            </div>
            <span style={{ fontWeight: 600, color: '#6366f1' }}>{c.base_hourly_rate} SEK/h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
