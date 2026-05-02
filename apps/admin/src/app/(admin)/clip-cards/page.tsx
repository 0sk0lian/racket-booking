'use client';
import { useEffect, useState } from 'react';
const API = '/api';

export default function ClipCardsPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [cards, setCards] = useState<any[]>([]); const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/matchi/clip-cards?clubId=${clubId}`).then(r => r.json()).then(r => { setCards(r.data || []); setLoading(false); }); }, [clubId]);

  const clipCards = cards.filter(c => c.type === 'clip');
  const valueCards = cards.filter(c => c.type === 'value');
  const totalValue = valueCards.reduce((s, c) => s + (c.remaining_value || 0), 0);
  const totalClips = clipCards.reduce((s, c) => s + (c.remaining_clips || 0), 0);

  return (
    <div>
      <div className="page-header"><h1>Klippkort & Värdekort</h1></div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div className="label">Klippkort</div><div className="value" style={{ color: '#6366f1' }}>{clipCards.length}</div><div className="sub">{totalClips} klipp kvar totalt</div></div>
        <div className="stat-card"><div className="label">Värdekort</div><div className="value" style={{ color: '#06b6d4' }}>{valueCards.length}</div><div className="sub">{totalValue.toLocaleString()} SEK saldo</div></div>
        <div className="stat-card"><div className="label">Totalt Försäljning</div><div className="value" style={{ color: '#10b981' }}>{cards.reduce((s, c) => s + c.price, 0).toLocaleString()}</div><div className="sub">SEK</div></div>
        <div className="stat-card"><div className="label">Aktiva Kort</div><div className="value" style={{ color: '#f59e0b' }}>{cards.length}</div></div>
      </div>

      {loading ? <div className="loading">Laddar...</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Namn</th><th>Typ</th><th>Ägare</th><th>Status</th><th>Pris</th><th>Giltig</th><th>Restriktioner</th></tr></thead>
            <tbody>
              {cards.map(c => {
                const pct = c.type === 'clip' ? ((c.remaining_clips || 0) / (c.total_clips || 1) * 100) : ((c.remaining_value || 0) / (c.total_value || 1) * 100);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><span className={`badge ${c.type === 'clip' ? 'badge-blue' : 'badge-green'}`}>{c.type === 'clip' ? 'Klippkort' : 'Värdekort'}</span></td>
                    <td>{c.owner_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{c.type === 'clip' ? `${c.remaining_clips}/${c.total_clips}` : `${c.remaining_value?.toLocaleString()} / ${c.total_value?.toLocaleString()} kr`}</span>
                        <div style={{ width: 60, height: 6, background: 'var(--bg-body)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} /></div>
                      </div>
                    </td>
                    <td>{c.price} SEK</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.valid_from?.substring(5)} — {c.valid_until?.substring(5)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {c.restricted_hours ? `${c.restricted_hours.start}:00-${c.restricted_hours.end}:00` : 'Alla tider'}
                      {c.restricted_sports ? ` · ${c.restricted_sports.join(', ')}` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };

