'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Match { id: string; host_name: string; sport_type: string; court_name: string; date: string; start_hour: number; end_hour: number; min_level: number; max_level: number; spots_total: number; spots_filled: number; is_host: boolean; has_joined: boolean; visibility: string; }

export default function ClubMatchesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = () => fetch(`/api/matches/browse?clubId=${slug}`).then(r => r.json()).then(r => { setMatches(r.data ?? []); setLoading(false); });
  useEffect(() => { load(); }, [slug]);

  const join = async (matchId: string) => {
    setJoining(matchId);
    const res = await fetch(`/api/matches/${matchId}/join`, { method: 'POST' }).then(r => r.json());
    if (res.success) { setToast('Du gick med!'); load(); }
    else { setToast(res.error ?? 'Misslyckades'); }
    setJoining(null);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>← Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Öppna matcher</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Hitta en match att gå med i. Nivå 1-10.</p>

      {toast && <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{toast}</div>}

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>🎾</p>
          <h3 style={{ color: '#334155' }}>Inga öppna matcher just nu</h3>
          <p>Boka en tid och öppna den för andra!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matches.map(m => (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{m.court_name}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>{m.sport_type}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#eef2ff', color: '#4f46e5' }}>Nivå {m.min_level}-{m.max_level}</span>
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {new Date(m.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' '}
                  {String(m.start_hour).padStart(2, '0')}:00–{String(m.end_hour).padStart(2, '0')}:00
                  {' · '}{m.host_name}
                </div>
                <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>{m.spots_filled}/{m.spots_total} spelare</div>
              </div>
              <div>
                {m.has_joined || m.is_host ? (
                  <span style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#ecfdf5', color: '#059669' }}>{m.is_host ? 'Din match' : '✓ Med'}</span>
                ) : m.spots_filled >= m.spots_total ? (
                  <span style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fef2f2', color: '#dc2626' }}>Fullt</span>
                ) : (
                  <button onClick={() => join(m.id)} disabled={joining === m.id} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#10b981', border: 'none', cursor: joining === m.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {joining === m.id ? '...' : 'Gå med'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
