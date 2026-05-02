'use client';
import { useEffect, useState } from 'react';
const API = '/api';
const DAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

export default function SeasonsPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [seasons, setSeasons] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  const reload = async () => { if (!clubId) return; setLoading(true); const r = await fetch(`${API}/matchi/seasons?clubId=${clubId}`).then(r => r.json()); setSeasons(r.data || []); setLoading(false); };
  useEffect(() => { reload(); }, [clubId]);

  const copyToSeason = async (sourceId: string, targetId: string) => {
    const r = await fetch(`${API}/matchi/seasons/${sourceId}/copy-to/${targetId}`, { method: 'POST' }).then(r => r.json());
    flash(`${r.data?.copied || 0} abonnemang kopierade!`);
    await reload();
  };

  const totalSubs = seasons.reduce((s, se) => s + se.subscription_count, 0);
  const activeSeason = seasons.find(s => s.status === 'active');
  const draftSeason = seasons.find(s => s.status === 'draft');

  return (
    <div>
      <div className="page-header"><h1>Säsonger & Abonnemang</h1></div>
      {toast && <div className="toast">{toast}</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        {activeSeason && draftSeason && (
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => copyToSeason(activeSeason.id, draftSeason.id)}>
              Kopiera abonnemang → {draftSeason.name}
            </button>
          </div>
        )}
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div className="label">Säsonger</div><div className="value" style={{ color: '#6366f1' }}>{seasons.length}</div></div>
        <div className="stat-card"><div className="label">Totalt Abonnemang</div><div className="value" style={{ color: '#10b981' }}>{totalSubs}</div></div>
        <div className="stat-card"><div className="label">Aktiv Säsong</div><div className="value" style={{ color: '#06b6d4', fontSize: 18 }}>{activeSeason?.name || '—'}</div></div>
      </div>

      {loading ? <div className="loading">Laddar...</div> : seasons.map(season => (
        <div key={season.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{season.name}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{season.start_date} → {season.end_date} &middot; {season.subscription_count} abonnemang</div>
            </div>
            <span className={`badge ${season.status === 'active' ? 'badge-green' : season.status === 'completed' ? 'badge-blue' : 'badge-yellow'}`}>{season.status === 'active' ? 'Aktiv' : season.status === 'draft' ? 'Kommande' : 'Avslutad'}</span>
          </div>
          {season.subscriptions?.length > 0 && (
            <table style={{ fontSize: 13 }}>
              <thead><tr><th>Kund</th><th>Bana</th><th>Dag</th><th>Tid</th><th>Pris/pass</th><th>Frekvens</th><th>Status</th></tr></thead>
              <tbody>
                {season.subscriptions.map((sub: any) => (
                  <tr key={sub.id}>
                    <td style={{ fontWeight: 600 }}>{sub.customer_name}</td>
                    <td>{sub.court_name}</td>
                    <td><span style={{ fontWeight: 600 }}>{sub.day_name}</span></td>
                    <td>{String(sub.start_hour).padStart(2, '0')}:00 — {String(sub.end_hour).padStart(2, '0')}:00</td>
                    <td style={{ fontWeight: 600 }}>{sub.price_per_session} SEK</td>
                    <td>{sub.frequency === 'weekly' ? 'Varje vecka' : 'Varannan vecka'}</td>
                    <td><span className={`badge ${sub.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>{sub.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {season.subscriptions?.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Inga abonnemang ännu</div>}
        </div>
      ))}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };

