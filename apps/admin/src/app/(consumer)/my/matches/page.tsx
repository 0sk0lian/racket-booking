'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Match { id: string; sport_type: string; court_name: string; date: string; start_hour: number; end_hour: number; min_level: number; max_level: number; spots_total: number; spots_filled: number; status: string; host_name: string; is_host: boolean; has_joined: boolean; visibility: string; }

export default function MyMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/matches/browse').then(r => r.json()).then(r => {
      const mine = (r.data ?? []).filter((m: Match) => m.is_host || m.has_joined);
      setMatches(mine);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mina matcher</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Matcher du skapat eller gått med i.</p>

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>🎾</p>
          <h3 style={{ color: '#334155' }}>Inga matcher</h3>
          <p>Boka en tid och öppna den för andra spelare!</p>
          <Link href="/clubs" style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>Hitta en bana</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matches.map(m => (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{m.court_name}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>{m.sport_type}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#eef2ff', color: '#4f46e5' }}>Nivå {m.min_level}–{m.max_level}</span>
                  {m.is_host && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#b45309' }}>Din match</span>}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {new Date(m.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' '}{String(m.start_hour).padStart(2, '0')}:00–{String(m.end_hour).padStart(2, '0')}:00
                </div>
                <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>{m.spots_filled}/{m.spots_total} spelare</div>
              </div>
              <span style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: m.status === 'open' ? '#ecfdf5' : m.status === 'full' ? '#eef2ff' : '#f1f5f9', color: m.status === 'open' ? '#059669' : m.status === 'full' ? '#4f46e5' : '#64748b', textTransform: 'capitalize' }}>{m.status === 'open' ? 'Öppen' : m.status === 'full' ? 'Full' : m.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
