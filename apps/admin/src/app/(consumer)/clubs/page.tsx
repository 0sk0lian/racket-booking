'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Club { id: string; name: string; city: string | null; }
interface Court { id: string; club_id: string; sport_type: string; base_hourly_rate: number; }

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/clubs').then(r => r.json()),
      fetch('/api/courts').then(r => r.json()),
    ]).then(([c, co]) => {
      setClubs(c.data ?? []);
      setCourts(co.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Anläggningar</h1>
      <p style={{ fontSize: 15, color: '#64748b', marginBottom: 32 }}>
        Hitta en padel- eller tennishall nära dig och boka tid direkt.
      </p>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Laddar anläggningar...</p>
      ) : clubs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>🏟️</p>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#334155' }}>Inga anläggningar ännu</h3>
          <p>Nya anläggningar läggs till löpande.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {clubs.map(club => {
            const cc = courts.filter(c => c.club_id === club.id);
            const sports = [...new Set(cc.map(c => c.sport_type))];
            const minPrice = cc.length > 0 ? Math.min(...cc.map(c => c.base_hourly_rate)) : null;
            return (
              <Link href={`/clubs/${club.id}`} key={club.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ height: 120, background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'rgba(255,255,255,0.25)' }}>{club.name.charAt(0)}</span>
                </div>
                <div style={{ padding: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{club.name}</h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>{club.city ?? 'Sverige'} · {cc.length} banor</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {sports.map(s => <span key={s} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>{s}</span>)}
                  </div>
                  {minPrice && <p style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>Från {minPrice} SEK/h</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
