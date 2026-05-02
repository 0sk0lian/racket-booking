'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
const API = '/api';

export default function LeaguesPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [leagues, setLeagues] = useState<any[]>([]); const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/matchi/leagues?clubId=${clubId}`).then(r => r.json()).then(r => { setLeagues(r.data || []); setLoading(false); }); }, [clubId]);

  const totalPlayers = new Set(leagues.flatMap(l => l.player_ids)).size;
  const totalMatches = leagues.reduce((s, l) => s + l.matches_played, 0);

  return (
    <div>
      <div className="page-header"><h1>Ligor (Backhandsmash)</h1></div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div className="label">Aktiva Ligor</div><div className="value" style={{ color: '#6366f1' }}>{leagues.filter(l => l.status === 'active').length}</div></div>
        <div className="stat-card"><div className="label">Spelare</div><div className="value" style={{ color: '#06b6d4' }}>{totalPlayers}</div></div>
        <div className="stat-card"><div className="label">Matcher Spelade</div><div className="value" style={{ color: '#10b981' }}>{totalMatches}</div></div>
        <div className="stat-card"><div className="label">Sporter</div><div className="value" style={{ color: '#f59e0b' }}>{new Set(leagues.map(l => l.sport_type)).size}</div></div>
      </div>

      {loading ? <div className="loading">Laddar...</div> : (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {leagues.map(l => (
            <Link key={l.id} href={`/leagues/${l.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l.name}</h3><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.season} &middot; {l.division} &middot; {l.format}</div></div>
                  <span className={`badge ${l.status === 'active' ? 'badge-green' : l.status === 'completed' ? 'badge-blue' : 'badge-yellow'}`}>{l.status}</span>
                </div>
                <div style={{ padding: '12px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Toppställning</div>
                  {l.standings?.slice(0, 5).map((s: any, i: number) => (
                    <div key={s.player_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                      <span style={{ width: 20, fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--text-dim)' }}>{i + 1}</span>
                      <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 400 }}>{s.player_name}</span>
                      <span style={{ fontWeight: 600, color: '#6366f1' }}>{s.points}p</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.wins}V-{s.losses}F</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '10px 20px', background: 'var(--bg-body)', fontSize: 12, color: 'var(--text-muted)' }}>
                  {l.player_count} spelare &middot; {l.matches_played} matcher &middot; <span className={`badge ${l.sport_type === 'padel' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: 10 }}>{l.sport_type}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };

