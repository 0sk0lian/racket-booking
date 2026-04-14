'use client';
import { useEffect, useState } from 'react';
const API = 'http://localhost:3001/api';

export default function PublicMatchesPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [matches, setMatches] = useState<any[]>([]); const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  useEffect(() => { Promise.all([fetch(`${API}/clubs`).then(r => r.json()), fetch(`${API}/users`).then(r => r.json())]).then(([c, u]) => { setClubs(c.data || []); setUsers(u.data || []); if (c.data?.length) setClubId(c.data[0].id); }); }, []);

  const reload = async () => { if (!clubId) return; setLoading(true); const r = await fetch(`${API}/matchi/public-matches?clubId=${clubId}`).then(r => r.json()); setMatches(r.data || []); setLoading(false); };
  useEffect(() => { reload(); }, [clubId]);

  const join = async (matchId: string, userId: string) => { await fetch(`${API}/matchi/public-matches/${matchId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); flash('Spelare tillagd!'); await reload(); };

  return (
    <div>
      <div className="page-header"><h1>Publika Matcher</h1></div>
      {toast && <div className="toast">{toast}</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>{matches.filter(m => m.status === 'open').length} öppna matcher</div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {matches.map(m => (
            <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className={`badge ${m.sport_type === 'padel' ? 'badge-blue' : 'badge-green'}`}>{m.sport_type}</span>
                  <span className={`badge ${m.status === 'open' ? 'badge-green' : 'badge-yellow'}`}>{m.status === 'open' ? `${m.spots_remaining} platser kvar` : 'Full'}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{m.court_name}</h3>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.date} &middot; {String(m.start_hour).padStart(2, '0')}:00 — {String(m.end_hour).padStart(2, '0')}:00</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Nivå {m.min_level}-{m.max_level} &middot; Arrangör: {m.host_name}</div>
                {m.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>"{m.notes}"</div>}
              </div>
              <div style={{ padding: '12px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Spelare ({m.spots_filled}/{m.spots_total})</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {m.players?.map((p: any) => <span key={p.id} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>{p.name}</span>)}
                  {Array.from({ length: m.spots_remaining }).map((_, i) => <span key={`empty-${i}`} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: 'var(--bg-body)', color: 'var(--text-dim)', border: '1px dashed var(--border)' }}>Ledig plats</span>)}
                </div>
                {m.status === 'open' && (
                  <select onChange={e => { if (e.target.value) join(m.id, e.target.value); e.target.value = ''; }} style={{ ...inp, fontSize: 12 }}>
                    <option value="">+ Lägg till spelare...</option>
                    {users.filter(u => !m.player_ids?.includes(u.id)).map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
